# restricted.lucafchala.com

A capture-the-flag puzzle hosted at [restricted.lucafchala.com](https://restricted.lucafchala.com).

Something is locked behind the page. Your objective is to get past the gate, retrieve the correct access code, and claim a spot on the leaderboard. Everything you need is already on the page — no guessing, no brute force.

The leaderboard is visible to everyone, including people who haven't solved it yet.

Good luck.
   ```
2. The worker will be live at `https://ctf-leaderboard.lucafchala.workers.dev`. If your Cloudflare subdomain differs, update the `WH` variable in `index.html` to match.

### Subsequent deploys

Any change to `src/index.ts` needs `wrangler deploy` to go live. Changes to `index.html` go live automatically via Cloudflare Pages on push to `main`.
