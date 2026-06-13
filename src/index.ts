const VALID_CODE = 'GNC98C';

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface Env {
  KV: KVNamespace;
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

    if (request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const allowed = await checkRateLimit(env.KV, ip, 'submit', 5, 3600);
      if (!allowed) {
        return json({ ok: false, error: 'Too many requests. Try again later.' }, 429);
      }

      try {
        const body = await request.json() as Partial<LeaderboardEntry & { code: string }>;
        const { username, code, ts, social } = body;

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
