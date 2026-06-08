const VALID_CODE = 'GNC98C';

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface Env {
  KV: KVNamespace;
  TURNSTILE_SECRET_KEY?: string;
}

interface LeaderboardEntry {
  username: string;
  ts: string;
  social?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  key: string,
  limit: number,
  windowSecs: number,
): Promise<boolean> {
  const window = Math.floor(Date.now() / (windowSecs * 1000));
  const kvKey = `ratelimit:${key}:${ip}:${window}`;
  const count = parseInt((await kv.get(kvKey)) ?? '0', 10);
  if (count >= limit) return false;
  await kv.put(kvKey, String(count + 1), { expirationTtl: windowSecs });
  return true;
}

async function verifyTurnstile(token: string | undefined, env: Env): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // graceful degradation if secret not configured
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.searchParams.get('action') === 'list') {
      try {
        const entries = (await env.KV.get('entries', 'json') as LeaderboardEntry[]) || [];
        return json(entries);
      } catch {
        return json([]);
      }
    }

    // Lightweight Turnstile preflight — verifies the token from the code step
    if (request.method === 'POST' && url.pathname === '/api/verify') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const allowed = await checkRateLimit(env.KV, ip, 'verify', 10, 3600);
      if (!allowed) return json({ ok: false, error: 'Too many requests.' }, 429);
      let token: string | undefined;
      try {
        const body = await request.json() as { token?: string };
        token = body.token;
      } catch {
        return json({ ok: false, error: 'Invalid request.' }, 400);
      }
      const ok = await verifyTurnstile(token, env);
      return json({ ok });
    }

    if (request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const allowed = await checkRateLimit(env.KV, ip, 'submit', 5, 3600);
      if (!allowed) {
        return json({ ok: false, error: 'Too many requests. Try again later.' }, 429);
      }

      try {
        const body = await request.json() as Partial<LeaderboardEntry & { code: string; turnstileToken: string }>;
        const { username, code, ts, social, turnstileToken } = body;

        const tsOk = await verifyTurnstile(turnstileToken, env);
        if (!tsOk) {
          return json({ ok: false, error: 'Security check failed. Reload and try again.' }, 403);
        }

        if (!username || typeof username !== 'string') {
          return json({ ok: false, error: 'Username required.' });
        }
        if (code !== VALID_CODE) {
          return json({ ok: false, error: 'Invalid code.' });
        }

        const trimmed = username.trim().slice(0, 32);
        if (!trimmed) return json({ ok: false, error: 'Username required.' });

        const entries = (await env.KV.get('entries', 'json') as LeaderboardEntry[]) || [];
        if (entries.some(e => e.username.toLowerCase() === trimmed.toLowerCase())) {
          return json({ ok: false, error: 'Username already taken.' });
        }

        const entry: LeaderboardEntry = { username: trimmed, ts: ts || new Date().toISOString() };
        if (social && typeof social === 'string') entry.social = social.trim().slice(0, 64) || undefined;
        entries.push(entry);
        await env.KV.put('entries', JSON.stringify(entries));
        return json({ ok: true });
      } catch {
        return json({ ok: false, error: 'Server error.' }, 500);
      }
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};
