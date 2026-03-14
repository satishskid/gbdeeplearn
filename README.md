# DeepLearn AI Platform

Hybrid, offline-first LMS scaffold built with Astro + React + Tailwind and Cloudflare Worker APIs.

## Vision, Progress, and Current State (Knowledge Transfer)

Core direction:
- **The AI Academy for Doctors Who Want to Practice, Publish, and Build**

Current platform state:
1. Public academy at `med.greybrain.ai` is redesigned and operational with a path-led homepage, briefs, courses, enrollment, and counselor flow.
2. Internal ops stack is live for content editing, CRM, cohorts, analytics, and learner operations.
3. Learning model is live as `starter refresher -> path recommendation -> deeper cohort`.

Working product tracks:
1. **Practice** (`Path 1`): clinical productivity and communication.
2. **Publish** (`Path 2`): research acceleration and academic output.
3. **Build** (`Path 3`): healthcare entrepreneurship and pilot-to-venture workflows.

Detailed handover for the next developer:
- [docs/developer-handover-2026-03-09.md](/Users/spr/gbdeeplearn/docs/developer-handover-2026-03-09.md)

Design + execution context:
- [docs/greybrain-public-v2-system-spec.md](/Users/spr/gbdeeplearn/docs/greybrain-public-v2-system-spec.md)
- [docs/greybrain-public-v2-orchestration-contract.md](/Users/spr/gbdeeplearn/docs/greybrain-public-v2-orchestration-contract.md)
- [docs/ai-refresher-blueprint.md](/Users/spr/gbdeeplearn/docs/ai-refresher-blueprint.md)

## Quick start

```bash
npm install
npm run dev
```

### AI-Assisted Testing (TestSprite MCP)

This project supports [TestSprite](https://testsprite.com) for automated E2E testing. To enable the TestSprite MCP in your IDE (Cursor/VS Code), add the following to your `mcpServers` configuration:

```json
{
  "TestSprite": {
    "command": "npx",
    "args": ["@testsprite/testsprite-mcp@latest"],
    "env": {
      "API_KEY": "YOUR_API_KEY"
    }
  }
}
```
A reference `.mcp.json` is provided in the project root.

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
PUBLIC_COUNSELOR_EMAILS=
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

### 7) Publish latest brief and redeploy Pages (CLI-first)

This is the simplest path for your current Direct Upload setup.

Publish the latest draft brief, rebuild the site, and deploy Pages:

```bash
ADMIN_API_TOKEN=... npm run content:publish-and-deploy
```

Publish a specific post:

```bash
ADMIN_API_TOKEN=... npm run content:publish-and-deploy -- --post-id=<content_post_id>
```

Or by slug:

```bash
ADMIN_API_TOKEN=... npm run content:publish-and-deploy -- --slug=daily-20260307
```

Dry run:

```bash
ADMIN_API_TOKEN=... npm run content:publish-and-deploy -- --dry-run
```

Rebuild and deploy Pages only, without changing content status:

```bash
npm run content:deploy-pages
```

Seed evergreen workflow/wiki/model-watch entries:

```bash
ADMIN_API_TOKEN=... npm run content:seed-evergreen
```

## Strict Release Gate (No Drift)

Single command to enforce end-to-end production gates:

```bash
ADMIN_API_TOKEN=... \
DEEPLEARN_API_BASE_URL=https://deeplearn-worker.satish-9f4.workers.dev \
DEEPLEARN_PAGES_BASE_URL=https://med.greybrain.ai \
npm run release:orchestrate
```

Outputs:
- `reports/release-gate-latest.json`
- `reports/release-gate-<timestamp>.json`

Reference contract:
- [docs/release-orchestration-contract.md](/Users/spr/gbdeeplearn/docs/release-orchestration-contract.md)

GitHub Actions:
- Build gate: `.github/workflows/build.yml` (PR + `main`)
- Release gate: `.github/workflows/release-gate.yml` (`main` + manual)
- Pages direct upload: `.github/workflows/pages-direct-upload.yml` (manual + repository dispatch)

Required GitHub secret:
- `ADMIN_API_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Recommended GitHub repository variables:
- `DEEPLEARN_API_BASE_URL` (default in script: `https://deeplearn-worker.satish-9f4.workers.dev`)
### Production Credentials
- **Frontend URL**: `https://med.greybrain.ai`
- **API URL**: `https://gb-baas.codex.workers.dev` (Internal)
- `EXPECTED_COORDINATOR_EMAILS` (default: `satish@skids.health,drpratichi@skids.health`)
- `DISALLOWED_EMAIL_MARKERS` (default: `qa.coordinator.`)
- `PUBLIC_DEEPLEARN_API_ORIGIN` (recommended: `https://deeplearn-worker.satish-9f4.workers.dev`)
- all `PUBLIC_FIREBASE_*`, `PUBLIC_TURNSTILE_SITE_KEY`, role email allowlists, and messaging URLs used by the Astro build

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
npm run cf:secret:put -- LEAD_WEBHOOK_AUTH_TOKEN
npm run cf:secret:put -- LEAD_WEBHOOK_SECRET
npm run cf:secret:put -- ALERT_WEBHOOK_AUTH_TOKEN
npm run cf:secret:put -- ALERT_WEBHOOK_SECRET
npm run cf:secret:put -- ALERT_TELEGRAM_BOT_TOKEN
npm run cf:secret:put -- ALERT_TELEGRAM_CHAT_ID
npm run cf:secret:put -- ALERT_TELEGRAM_TOPIC_ID
npm run cf:secret:put -- ALERT_EMAIL_TO
npm run cf:secret:put -- ALERT_EMAIL_FROM
npm run cf:secret:put -- ALERT_EMAIL_FROM_NAME
npm run cf:secret:put -- ALERT_EMAIL_SUBJECT_PREFIX
npm run readiness:check
```

Optional Worker vars (set in `wrangler.toml` `[vars]`):
- `LEAD_WEBHOOK_URL`: Optional external integration endpoint for lead + payment mirrors (internal CRM works without this).
- `ALERT_WEBHOOK_URL`: incident channel endpoint (Slack/Discord/custom) for ops alerts.
- `ALERT_TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID`, `ALERT_TELEGRAM_TOPIC_ID`:
  send real-time ops alerts to Telegram (topic id is optional for forum groups).
- `ALERT_EMAIL_TO` (CSV), `ALERT_EMAIL_FROM`, `ALERT_EMAIL_FROM_NAME`, `ALERT_EMAIL_SUBJECT_PREFIX`:
  send ops alerts directly to target emails from the Worker via MailChannels.

Tutor content indexing automation:
- Published module create/update now auto-triggers course-content vector ingestion.
- Course status change to `published` or `live` also auto-triggers ingestion.
- Manual fallback endpoint remains: `POST /api/admin/knowledge/ingest-course-content`.

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
- Lead submission endpoint: `POST /api/lead/submit` (Cloudflare Worker, internal CRM-first).
- Turnstile: Enabled on lead form, server-verified in Worker.
- Internal CRM endpoints:
  - `GET /api/admin/crm/leads`
  - `POST /api/admin/crm/leads/:leadId`
- Access + role audit endpoint:
  - `GET /api/admin/access/audit`
- Optional external forwarding remains available only if you set `LEAD_WEBHOOK_URL`.

### Webinar events captured (`POST /api/track`)

- `webinar_landing_view`
- `cta_variant_assigned`
- `audience_path_selected`
- `webinar_scroll_25`
- `webinar_scroll_50`
- `webinar_scroll_75`
- `webinar_cta_click`
- `webinar_sticky_cta_click`
- `webinar_schedule_click`
- `webinar_registration_started`
- `webinar_registration_submitted`
- `payment_page_opened`
- `payment_completed`

Funnel summary endpoint:
- `GET /api/analytics/funnel?webinar_id=deep-rag-live-webinar&days=30`

### Counselor logistics ingestion

Seed and embed logistics context into Vectorize:

```bash
npm run seed:path123
```

This now calls:
- `POST /api/admin/knowledge/ingest-logistics`

Manual trigger:

```bash
curl -X POST "$DEEPLEARN_API_BASE_URL/api/admin/knowledge/ingest-logistics" \
  -H "x-admin-token: $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Counselor route still has DB-backed logistics fallback if vector chunks are empty.

### Ops monitoring and payment failure alerts

- Alerts API: `GET /api/admin/alerts?status=open&limit=100`
- Alert status update: `POST /api/admin/alerts/:alertId/status` with `{ "status": "acknowledged|resolved" }`
- Payment webhook and payment verification failures automatically create `ops_alerts` records.
- Optional outbound alerting: set `ALERT_WEBHOOK_URL` (+ auth/signing vars) to forward alerts externally.

### Production Readiness

- Checklist: [docs/production-readiness-checklist.md](/Users/spr/gbdeeplearn/docs/production-readiness-checklist.md)
- Incident runbook: [docs/incident-response-runbook.md](/Users/spr/gbdeeplearn/docs/incident-response-runbook.md)

Run automated readiness checks:

```bash
ADMIN_API_TOKEN=... \
DEEPLEARN_API_BASE_URL=https://deeplearn-worker.satish-9f4.workers.dev \
npm run readiness:check
```

## Daily Content Pipeline (Cloudflare + BYOK/Fallback)

The Worker now includes a built-in daily editorial pipeline for `Greybrain.AI Daily`:

- Generate draft (manual): `POST /api/admin/content/generate-daily`
  - Body: `{ "groq_key": "optional_byok_key", "force": false }`
  - Uses `groq_key` first, then falls back to Worker secret `GROQ_API_KEY`.
- Review list (reviewers): `GET /api/admin/content/posts?limit=20&status=all`
- Approve/Publish/Reject: `POST /api/admin/content/posts/:postId/status` with `{ "status": "approved|published|rejected" }`
- Force auto-publish sweep now: `POST /api/admin/content/auto-publish-expired`
- Public feed (published only): `GET /api/content/posts?limit=4`

Review policy (configurable in [wrangler.toml](/Users/spr/gbdeeplearn/wrangler.toml) `[vars]`):
- `CONTENT_REVIEW_WINDOW_MINUTES` (`180` default): time gap before fallback publish.
- `CONTENT_REVIEW_AUTO_PUBLISH` (`true`): publish expired drafts automatically.
- `CONTENT_APPROVED_AUTO_PUBLISH` (`true`): setting status=`approved` directly publishes.
- `CONTENT_REVIEWER_ROLES` (`coordinator,counselor,cto`): role-based approvers.
- `CONTENT_REVIEWER_EMAILS` (`satish@skids.health`): allowlist approvers by Firebase email.

Cron is configured in [wrangler.toml](/Users/spr/gbdeeplearn/wrangler.toml):
- `30 3 * * *` (daily at 03:30 UTC, 09:00 IST)
- `0 * * * *` (hourly auto-publish sweep)

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
