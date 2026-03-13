# Developer Handover - 2026-03-09

## Vision and Product Direction

Primary public narrative:
- **The AI Academy for Doctors Who Want to Practice, Publish, and Build**

Primary product direction:
1. Public academy site at `med.greybrain.ai` should drive discovery, trust, and enrollment.
2. Internal platform should run end-to-end operations: content, cohorts, CRM, progress, and analytics.
3. Learning journey should move from low-friction refresher to deeper cohort tracks.

Path model:
1. **Practice**: clinical productivity and communication workflows.
2. **Publish**: research acceleration and manuscript support.
3. **Build**: entrepreneurship and venture-building workflows.

## Current State (Implemented)

## Public Experience

Live sections and structure on homepage:
1. Hero with path selector and workflow visualization.
2. Product logic section ("Prompt -> Context -> Tutor -> Review -> Output").
3. Outcome path section (featured path + supporting paths).
4. Signal board + knowledge library (`Daily brief`, `Workflow`, `Wiki`, `Model Watch`).
5. Course showcase (starter refresher + cohort cards).
6. Unified enrollment + counselor section.

Design work completed:
- Card density reduced significantly.
- Dark atmospheric sections introduced for paths, signals, and courses.
- Visual system moved away from "internal dashboard" style.
- Contextual illustrations added for path sections and refresher flow.

Main files:
- `src/pages/index.astro`
- `src/styles/global.css`
- `src/components/AudienceCtaSwitcher.jsx`
- `src/components/WebinarLeadForm.jsx`
- `src/components/CounselorChat.jsx`

## Content and Publishing

Implemented:
1. Internal draft workflow with create/edit/approve/publish.
2. Optional BYOK generation plus manual editorial workflow.
3. Channel export formatting for LinkedIn/Facebook/X/Medium.
4. Canonical URL + source links support.
5. Native brief routes at `/briefs/<slug>`.
6. Taxonomy support: `daily_brief`, `workflow`, `wiki`, `model_watch`.
7. Evergreen seed scripts for wiki/workflow/model-watch content.

Main files:
- `src/worker.js`
- `src/pages/briefs/`
- `src/components/PlatformConsole.jsx`
- `src/lib/briefs.js`
- `src/lib/evergreenContent.js`
- `scripts/publish-brief-and-deploy.mjs`
- `scripts/seed-evergreen-content.mjs`

## Learner Product

Implemented:
1. Refresher course upgraded to interactive orientation.
2. Chapter interactions and progression tracking in learner UX.
3. Path recommendation flow at refresher completion.
4. Learner hub module focus and lesson-brief surfaces.
5. Tutor context synchronization from learner module context.
6. Firestore + local fallback for refresher progress persistence.

Main files:
- `src/components/RefresherInteractiveExperience.jsx`
- `src/components/LearnerWorkspace.jsx`
- `src/components/ChatInterface.jsx`
- `src/pages/learn.astro`
- `src/lib/academyData.js`

## CRM and Operations

Implemented:
1. Internal CRM lead list and updates.
2. Segment filters and saved CRM views.
3. Batch actions (owner/stage/reminder).
4. Channel follow-up templates (WhatsApp/email/counselor handoff).
5. CRM action audit trail in D1.
6. Refresher conversion analytics and chapter drop-off visibility.

Main files:
- `src/components/PlatformConsole.jsx`
- `src/worker.js`
- `scripts/backfill-refresher-events.mjs`

## Infra, Deploy, and Release Gates

Implemented:
1. Worker + Pages deploy scripts via Wrangler.
2. Direct Upload Pages workflow and CLI-first publish pipeline.
3. Release orchestration command and report generation.
4. Cloudflare resource bootstrap scripts.

Main files:
- `package.json`
- `wrangler.toml`
- `scripts/cf-bootstrap.sh`
- `scripts/cf-cli.sh`
- `.github/workflows/pages-direct-upload.yml`

## Known Gaps and Immediate Next Work

Highest leverage gaps:
1. **Art direction quality** still trails system quality:
   - Needs stronger signature visuals and motion identity.
2. **Homepage mid/low sections** still use repeated surfaces:
   - More composition-led layout needed, fewer container motifs.
3. **Path 1 authored lesson metadata coverage**:
   - Ensure all modules have authored objectives/checklists/prompts.
4. **Brief quality control**:
   - Editorial normalization rules should tighten before scale.

## Recommended Next Sprint (Execution Order)

1. Design system hardening:
   - Refactor repeated section surface styles into a single tokenized pattern family.
2. Signature visual pass:
   - Replace generic illustration treatment with 2-3 bespoke visual motifs reused across hero/path/course.
3. Learning content quality pass:
   - Normalize Path 1 module outcomes and assignment briefs to match Path 2/3 maturity.
4. Publishing quality gate:
   - Add pre-publish validation for title/summary/source quality and content type completeness.

## Operational Commands (Day-2 Runbook)

Build + deploy:
```bash
npm run build
npm run cf:pages:deploy
npm run cf:worker:deploy
```

Content publish:
```bash
ADMIN_API_TOKEN=... npm run content:publish-and-deploy
```

Refresh static pages only:
```bash
npm run content:deploy-pages
```

Seed evergreen content:
```bash
ADMIN_API_TOKEN=... npm run content:seed-evergreen
```

Release gate:
```bash
ADMIN_API_TOKEN=... \
DEEPLEARN_API_BASE_URL=https://deeplearn-worker.satish-9f4.workers.dev \
DEEPLEARN_PAGES_BASE_URL=https://med.greybrain.ai \
npm run release:orchestrate
```

## Source Docs for New Developers

Read in this order:
1. `README.md`
2. `docs/developer-handover-2026-03-09.md`
3. `docs/greybrain-public-v2-system-spec.md`
4. `docs/greybrain-public-v2-orchestration-contract.md`
5. `docs/ai-refresher-blueprint.md`
6. `docs/release-readiness-audit-2026-03-03.md`
