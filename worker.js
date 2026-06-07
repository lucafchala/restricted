const VALID_CODE = 'GNC98C';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.searchParams.get('action') === 'list') {
      try {
        const entries = (await env.LEADERBOARD.get('entries', 'json')) || [];
        return json(entries);
      } catch {
        return json([]);
      }
    }

    if (request.method === 'POST') {
      try {
        const { username, code, ts, ua } = await request.json();

        if (!username || typeof username !== 'string') {
          return json({ ok: false, error: 'Username required.' });
        }
        if (code !== VALID_CODE) {
          return json({ ok: false, error: 'Invalid code.' });
        }

        const trimmed = username.trim().slice(0, 32);
        if (!trimmed) return json({ ok: false, error: 'Username required.' });

        const entries = (await env.LEADERBOARD.get('entries', 'json')) || [];
        if (entries.some(e => e.username.toLowerCase() === trimmed.toLowerCase())) {
          return json({ ok: false, error: 'Username already taken.' });
        }

        entries.push({
          username: trimmed,
          ts: ts || new Date().toISOString(),
        });

        await env.LEADERBOARD.put('entries', JSON.stringify(entries));
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: 'Server error.' }, 500);
      }
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};
