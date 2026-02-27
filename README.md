# DeepLearn AI Platform

Hybrid, offline-first LMS scaffold built with Astro + React + Tailwind and Cloudflare Worker APIs.

## Quick start

```bash
npm install
npm run dev
```

## Required env vars

Create `.env` with:

```bash
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_MEASUREMENT_ID=
```

## Worker local dev

```bash
npm run worker:dev
```

Bindings expected by `src/worker.js`:
- `AI` (Workers AI binding for embeddings)
- `DEEPLEARN_INDEX` (Vectorize index binding)
- `LEAD_ANALYTICS` (Analytics Engine dataset binding)
- `DEEPLEARN_LEADS` (R2 lead payload storage)

## Cloudflare CLI Setup (Wrangler)

Wrangler is fully configured for this project through:
- [wrangler.toml](/Users/spr/gbdeeplearn/wrangler.toml) (Worker + bindings)
- [wrangler.pages.toml](/Users/spr/gbdeeplearn/wrangler.pages.toml) (Pages metadata)
- [scripts/cf-cli.sh](/Users/spr/gbdeeplearn/scripts/cf-cli.sh) (wrapper with local log path)
- [scripts/cf-bootstrap.sh](/Users/spr/gbdeeplearn/scripts/cf-bootstrap.sh) (idempotent resource bootstrap)

Default account is set to `9f4998a66a5d7bd7a230d0222544fbe6` in the CLI wrapper.
Override when needed:

```bash
export CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID
```

### 1) Verify auth

```bash
npm run cf:whoami
```

### 2) Create required Cloudflare resources (CLI only)

This creates/checks:
- Vectorize index `deeplearn-index`
- R2 buckets `gbdeeplearn-assets`, `gbdeeplearn-assets-preview`, `gbdeeplearn-certificates`, `gbdeeplearn-certificates-preview`, `gbdeeplearn-leads`, `gbdeeplearn-leads-preview`
- Pages project `gbdeeplearn`

```bash
npm run cf:bootstrap
```

### 3) Local Worker development

```bash
npm run cf:worker:dev
```

### 4) Deploy Worker API

```bash
npm run cf:worker:deploy
```

### 5) Deploy Astro frontend to Pages

```bash
npm run build
npm run cf:pages:deploy
```

### 6) Deploy both (Worker + Pages)

```bash
npm run cf:deploy:all
```

### Useful CLI commands

```bash
npm run cf:worker:tail
npm run cf:vectorize:list
npm run cf:r2:list
npm run cf:pages:list
npm run cf:secret:list
npm run cf:secret:put -- GROQ_API_KEY
```

### AI Gateway wiring

- `src/worker.js` uses request `groq_key` first (BYOK), then falls back to Worker secret `GROQ_API_KEY`.
- To route through Cloudflare AI Gateway, set `AI_GATEWAY_BASE_URL` in [wrangler.toml](/Users/spr/gbdeeplearn/wrangler.toml).

Examples:
- Groq direct (default): `https://api.groq.com/openai/v1`
- AI Gateway provider route: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_name>/groq`
- AI Gateway OpenAI-compatible route: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_name>/compat`

If using `compat`, set model with provider prefix in `GROQ_MODEL` (for example `groq/llama-3.3-70b-versatile`).

## Webinar Tracking Decisions

- Tutor auth behavior: `BYOK + server fallback` (current).
- Analytics storage: `Cloudflare Analytics Engine` for edge click/lead counts.
- Lead payload storage: `Cloudflare R2` bucket (`gbdeeplearn-leads`) for submitted registration details.
- Lead submission endpoint: `POST /api/lead/submit` (Cloudflare Worker, no external CRM required).

### Webinar events captured (`POST /api/track`)

- `webinar_landing_view`
- `webinar_cta_click`
- `webinar_schedule_click`
- `webinar_registration_started`
- `webinar_registration_submitted`
- `payment_page_opened`
- `payment_completed`
