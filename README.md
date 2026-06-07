# restricted.lucafchala.com

A capture-the-flag puzzle hosted at [restricted.lucafchala.com](https://restricted.lucafchala.com).

Something is locked behind the page. Your objective is to get past the gate, retrieve the correct access code, and claim a spot on the leaderboard. Everything you need is already on the page — no guessing, no brute force.

The leaderboard is visible to everyone, including people who haven't solved it yet.

Good luck.

---

## Deployment

The site is a single `index.html` deployed to **Cloudflare Pages** from this repo (no build step, output directory `/`). Custom domain: `restricted.lucafchala.com`.

The leaderboard backend is a **Cloudflare Worker** with KV storage.

### First-time worker setup

1. Create a KV namespace:
   ```
   wrangler kv namespace create LEADERBOARD
   wrangler kv namespace create LEADERBOARD --preview
   ```
2. Copy the IDs printed by those commands into `wrangler.toml`, replacing the two `REPLACE_WITH_KV_NAMESPACE_ID` placeholders.
3. Deploy:
   ```
   wrangler deploy
   ```
4. The worker URL will be `https://ctf-leaderboard.YOUR_SUBDOMAIN.workers.dev`. If your subdomain differs from `lucafchala`, update the `WH` variable in `index.html` to match.

### Subsequent deploys

Any change to `worker.js` needs `wrangler deploy` to go live. Changes to `index.html` go live automatically via Cloudflare Pages on push to `main`.
