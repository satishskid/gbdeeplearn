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
PUBLIC_TURNSTILE_SITE_KEY=
PUBLIC_COORDINATOR_EMAILS=
PUBLIC_TEACHER_EMAILS=
PUBLIC_CTO_EMAILS=
```

Role resolution order in UI guards:
1. Firebase custom claims (`role`, `roles`)
2. Firestore `users/{uid}` fields (`role`, `roles`)
3. Email allowlists from `PUBLIC_*_EMAILS`

Enable `Email/Password` sign-in provider in Firebase Authentication for login UI on `/console` and `/learn`.

## Worker local dev

```bash
npm run worker:dev
```

Bindings expected by `src/worker.js`:
- `AI` (Workers AI binding for embeddings)
- `DEEPLEARN_INDEX` (Vectorize index binding)
- `DEEPLEARN_DB` (D1 analytics + funnel storage)
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
- D1 database `deeplearn-ops` should be created once (already provisioned in this workspace)

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

Apply D1 ops schema (courses, staff, enrollments, lead events):

```bash
npm run cf:d1:migrate
```

### 5) Deploy Astro frontend to Pages

```bash
npm run build
npm run cf:pages:deploy
```

Notes:
- [public/_worker.js](/Users/spr/gbdeeplearn/public/_worker.js) proxies `https://<pages-domain>/api/*` to the Worker URL.
- This keeps frontend API calls same-origin on Pages (`/api/...`) while all logic stays in Cloudflare Worker.

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
npm run cf:secret:put -- TURNSTILE_SECRET_KEY
npm run cf:secret:put -- ADMIN_API_TOKEN
```

## Platform routes

- Public learner site (blogs + courses + enroll): `/`
- Course catalog: `/courses`
- Course detail template: `/courses/:slug`
- Goal-based tracks + compare: `/tracks` and `/tracks/:slug`
- B2B platform page (partners + investors): `/platform`
- Internal role console (Coordinator / Teacher / CTO): `/console`
- Learner Hub (enrolled learner + staff access): `/learn`

### AI Gateway wiring

- `src/worker.js` uses request `groq_key` first (BYOK), then falls back to Worker secret `GROQ_API_KEY`.
- `AI_GATEWAY_BASE_URL` is configured to Cloudflare `compat` gateway in [wrangler.toml](/Users/spr/gbdeeplearn/wrangler.toml).
- `AI_GATEWAY_NAME` is just the unique gateway identifier in your Cloudflare account (set to `deeplearn-gateway`).

Examples:
- Groq direct (default): `https://api.groq.com/openai/v1`
- AI Gateway provider route: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_name>/groq`
- AI Gateway OpenAI-compatible route: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_name>/compat`

If using `compat`, set model with provider prefix in `GROQ_MODEL` (for example `groq/llama-3.3-70b-versatile`).

## Webinar Tracking Decisions

- Tutor auth behavior: `BYOK + server fallback` (current).
- Analytics storage: `Cloudflare D1` for edge click/lead counts and funnel queries.
- Lead payload storage: `Cloudflare R2` bucket (`gbdeeplearn-leads`) for submitted registration details.
- Lead submission endpoint: `POST /api/lead/submit` (Cloudflare Worker, no external CRM required).
- Turnstile: Enabled on lead form, server-verified in Worker.

### Webinar events captured (`POST /api/track`)

- `webinar_landing_view`
- `webinar_cta_click`
- `webinar_schedule_click`
- `webinar_registration_started`
- `webinar_registration_submitted`
- `payment_page_opened`
- `payment_completed`

Funnel summary endpoint:
- `GET /api/analytics/funnel?webinar_id=deep-rag-live-webinar&days=30`

## Daily Content Pipeline (Cloudflare + BYOK/Fallback)

The Worker now includes a built-in daily editorial pipeline for `Greybrain.AI Daily`:

- Generate draft (manual): `POST /api/admin/content/generate-daily`
  - Body: `{ "groq_key": "optional_byok_key", "force": false }`
  - Uses `groq_key` first, then falls back to Worker secret `GROQ_API_KEY`.
- Review list (admin): `GET /api/admin/content/posts?limit=20&status=all`
- Approve/Publish/Reject: `POST /api/admin/content/posts/:postId/status` with `{ "status": "approved|published|rejected" }`
- Public feed (published only): `GET /api/content/posts?limit=4`

Cron is configured in [wrangler.toml](/Users/spr/gbdeeplearn/wrangler.toml):
- `30 3 * * *` (daily at 03:30 UTC, 09:00 IST)

### Required secret for auto generation

```bash
npm run cf:secret:put -- GROQ_API_KEY
```

### Apply latest D1 schema

`npm run cf:d1:migrate` now applies all SQL files in `/migrations` in order, including content pipeline tables.

### Turnstile setup

Development defaults use Cloudflare's public test site key when `PUBLIC_TURNSTILE_SITE_KEY` is not set.

Set Worker secret for server verification:

```bash
npm run cf:secret:put -- TURNSTILE_SECRET_KEY
```

Set production site key for frontend build:

```bash
PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
```
