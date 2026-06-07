# restricted.lucafchala.com

> A self‑contained capture‑the‑flag puzzle: a static page hides a gate, the gate hides an access code, and the code earns a spot on a public leaderboard backed by a tiny Cloudflare Worker.

**Live:** [restricted.lucafchala.com](https://restricted.lucafchala.com) · **Worker:** `ctf-leaderboard.lucafchala.workers.dev` · **Stack:** static HTML + Cloudflare Worker (TypeScript) + Workers KV

Part of the [lucafchala.com ecosystem](https://github.com/lucafchala/lucafchala.com#the-ecosystem) (it does **not** use the shared design system — see [Design](#design)).

> **Spoiler‑free by design.** This README documents *how the project is built and deployed*, not how to solve it. The passphrase, the valid access code, and the derivation details are intentionally **omitted** so the puzzle stays solvable. Everything a solver needs is already on the page — "no guessing, no brute force."

---

## What it is

**One sentence:** `restricted` is a browser CTF where you get past a client‑side gate, work out a fixed 6‑character access code, and submit it with a username to a Cloudflare Worker that validates it server‑side and appends you to a shared leaderboard stored in KV.

**In a paragraph:** The whole challenge ships as one static `index.html` — the gate, the post‑gate "vault", and the leaderboard UI are all there, with the logic and clues deliberately obfuscated in the client. Getting the passphrase only reveals the next stage; the actual win condition is submitting the one correct access code. Submission goes to a small TypeScript Worker (`src/index.ts`) that holds the canonical answer and the leaderboard. The leaderboard is readable by anyone — including people who haven't solved it — which is part of the game.

---

## Architecture

```
            restricted.lucafchala.com (static index.html)
            │   gate → vault → leaderboard form         (all client-side, obfuscated)
            │
            │   GET  ?action=list   ─────────────►  ┌─────────────────────────────────────┐
            └─  POST {username, code} ───────────►  │  Worker: ctf-leaderboard            │
                                                    │  src/index.ts                       │
                                                    │   • validates code server-side      │
                                                    │   • appends entry to leaderboard     │
                                                    │   • CORS: Access-Control-Allow-Origin: *
                                                    │   • KV binding "KV" → key "entries"  │
                                                    └─────────────────────────────────────┘
```

- **Front end:** static `index.html`, served at `restricted.lucafchala.com`. Implements the gate (a hardcoded attempt limit with a cooldown, tracked in `localStorage`) and the vault submission UI. Honeypot paths/links exist to flag automated probing.
- **Back end:** a single Cloudflare Worker (`src/index.ts`):
  - `GET …?action=list` → returns the leaderboard as JSON.
  - `POST` with `{ username, code }` → validates `code` against the canonical value and, if correct, appends the entry.
  - CORS is open (`*`) so the static page can call it cross‑origin.
- **Storage:** a Workers **KV** namespace (binding `KV`), leaderboard under the key `entries`.
- **`robots.txt`** disallows `/vault`, `/api/`, and `/session` (decoy paths).

> **Where the answers live (for maintainers, not solvers):** the gate passphrase and clue logic are obfuscated inside `index.html`; the authoritative access code is a constant in `src/index.ts`. Change them there.

---

## Prerequisites

- **Node.js** and **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** v4 (`npx wrangler`).
- A **Cloudflare** account with a **KV namespace** bound as `KV` (the id is committed in `wrangler.jsonc`; replace it with your own namespace id if you fork).
- For CI deploys: a `CLOUDFLARE_API_TOKEN` GitHub Actions secret.

## Configuration

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ctf-leaderboard",
  "main": "src/index.ts",
  "compatibility_date": "2025-02-04",
  "observability": { "enabled": true },
  "kv_namespaces": [
    { "binding": "KV", "id": "c240dc4587cd4ee890a20761aae811e5" }
  ]
}
```

| Name | Type | Description |
|---|---|---|
| `KV` | KV binding | Stores the leaderboard (`entries` key) |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | Used by the deploy workflow to publish the Worker |

No other secrets are required; the access code is a constant in the Worker source, not an env var.

## Install & deploy

```bash
git clone https://github.com/lucafchala/restricted.git
cd restricted

# run the Worker locally
npx wrangler dev          # serves src/index.ts; open index.html separately for the front end

# deploy the Worker
npx wrangler deploy
```

**CI:** `.github/workflows/deploy-worker.yml` deploys the Worker on every push to `main` (and on manual `workflow_dispatch`) using `cloudflare/wrangler-action@v3` with `wranglerVersion: '4'` and the `CLOUDFLARE_API_TOKEN` secret. The static `index.html` is served from `restricted.lucafchala.com` (its own Pages/hosting setup).

---

## Leaderboard API

```
GET  https://ctf-leaderboard.lucafchala.workers.dev/?action=list
     → 200 { entries: [ { username, … } ] }

POST https://ctf-leaderboard.lucafchala.workers.dev/
     body: { "username": "...", "code": "..." }
     → 200 on a correct code (entry appended)   /   rejected otherwise
```

Responses include permissive CORS headers so the puzzle page can call the Worker directly from the browser.

---

## File structure

```
.
├── index.html                       # The full CTF: gate + vault + leaderboard UI (obfuscated client logic)
├── src/
│   └── index.ts                     # Cloudflare Worker: GET leaderboard, POST validated submission, KV "entries"
├── wrangler.jsonc                   # Worker config (name "ctf-leaderboard", KV binding, compat date)
├── robots.txt                       # Disallows decoy paths (/vault, /api/, /session)
└── .github/workflows/
    └── deploy-worker.yml            # Deploy Worker on push to main / manual dispatch (wrangler-action v4)
```

---

## Design

Intentionally **off‑brand** — this puzzle uses a vintage, printed‑document look rather than the [shared ecosystem design system](https://github.com/lucafchala/lucafchala.com#design-system):

- **Fonts:** *IM Fell English* (serif) + *Courier Prime* (monospace), from Google Fonts.
- **Palette:** warm paper — `--bg #f5f0e1`, `--paper #ede8d5`, `--ink #1a1612`, `--rule #c8b89a`, with `--red #8b1a1a` / `--green #1a4a1a` / `--link #00008b` for state.

The mismatch is deliberate: `restricted` is a standalone game, not a network page, so it doesn't inherit the amber‑on‑black identity.

---

## Status

**In production** as a live puzzle. The leaderboard is public and persists in KV.
