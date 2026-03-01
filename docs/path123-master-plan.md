# Path 1/2/3 Master Plan (DeepLearn + In-Silico + PhysiSciPreneur)

Date: 2026-03-01
Owner: Greybrain Platform Core

## 1) Strategic Decision

Run all three paths on one shared Cloudflare-first platform kernel:
- Shared: auth, RBAC, course shell, analytics, lead funnel, AI gateway/fallback, content pipeline, admin console.
- Path-specific: curriculum, labs, tutor personas, capstone artifacts, landing copy, assessment rubrics.

This avoids three separate infra stacks and keeps operations centralized.

## 2) Repo Study Summary

Current Path 3 repo (`PhysiSciPreneur`) is valuable for curriculum and role workflows, but not deploy-ready as-is:
- Frontend is Vite React SPA, not Astro (see `App.tsx`).
- Backend is Netlify Functions + Neon Postgres (`netlify/functions/*`, `utils/db.ts`).
- Setup schema is missing (`setup/schema.sql` is empty).
- `package.json` has no standard build/dev scripts and minimal deps.
- `netlify.toml` is empty.

Reusable assets:
- Curriculum structure and module taxonomy.
- Student/Instructor/Admin workflow ideas.
- Instructor unlock model + project asset concepts.
- AI utility endpoints pattern (generate/enhance/slides/teaching aid).

Must be replatformed:
- Netlify functions -> Cloudflare Worker routes.
- Postgres schema -> D1 schema.
- Auth glue -> existing Firebase + role gate in `gbdeeplearn`.

## 3) Target Architecture

### 3.1 Platform Kernel (single source of truth)
- Runtime: Astro + React islands + Cloudflare Pages + Worker + D1 + Vectorize + R2.
- Global services:
  - Identity/RBAC
  - Course catalog and cohort engine
  - AI orchestration (BYOK first, server fallback)
  - Analytics + lead funnel + completion metrics
  - Content automation and review pipeline

### 3.2 Path Verticals
- Path 1 (Productivity): operational AI workflows for clinicians.
- Path 2 (Research): In-Silico Investigator labs + RAG tutor.
- Path 3 (Entrepreneurship): PhysiSciPreneur modules + capstone venture studio.

### 3.3 Route Model
- Public learner site: `/`
- Tracks:
  - `/tracks/productivity`
  - `/tracks/research`
  - `/tracks/entrepreneurship`
- Course pages: `/courses/:slug`
- Learning hub: `/learn/:courseSlug/:moduleId`
- White-label org mode (Path 2/3 B2B): `/:orgSlug/...`
- Internal ops: `/console`

## 4) Unified Data Model (D1)

### 4.1 Core entities
- `organizations`
- `platform_users`
- `courses`
- `course_modules`
- `cohorts`
- `cohort_unlocks`
- `enrollments`
- `module_progress`
- `assignments`
- `submissions`
- `certificates`

### 4.2 AI + content entities
- `ai_provider_settings` (BYOK/fallback policies per org/path)
- `rag_documents` + `rag_chunks`
- `content_posts` + `content_generation_runs` (already added)
- `lab_runs` (Path 2/3 experiment audit)

### 4.3 Analytics entities
- `lead_events` (already in place)
- `learning_events`
- `assessment_events`
- `conversion_rollups` (materialized daily)

## 5) RBAC and Governance

Roles (global):
- `cto`
- `coordinator`
- `teacher`
- `student`
- `org_admin` (optional for white-label tenants)

Policy rules:
- Coordinator/CTO create/publish courses and manage staff.
- Teacher manages module assets, assignments, unlock flow.
- Students consume, submit, complete.
- Org admin scoped to their `org_id` only.

## 6) Sub-Agent Execution Discipline

Define strict work lanes with no overlap:

### Lane A: Platform Core Agent
- Owns shared contracts, D1 migrations, Worker middleware, RBAC, telemetry.
- Cannot implement path-specific UI without contract freeze.

### Lane B: Path 1 Agent
- Owns productivity curriculum and learner UX blocks.
- Uses only published shared APIs.

### Lane C: Path 2 Agent
- Owns In-Silico labs, RAG research tutor, methods pedagogy assets.
- Uses shared `ai/chat`, `ai/lab`, `rag` services.

### Lane D: Path 3 Agent
- Owns entrepreneurship modules, capstone workspace, venture artifacts.
- Reuses shared cohort/unlock/progress/certificate flows.

### Lane E: QA/Ops Agent
- Contract tests, UI smoke tests, migration checks, deploy health checks.

Enforcement:
- Contract-first PRs.
- No lane merges without schema/API compatibility checks.
- CI gates: lint, typecheck, integration smoke, role-permission tests.

## 7) 6-Week Parallel Delivery Plan

### Week 1: Contract Freeze + Schema
- Finalize global API contracts and D1 ERD.
- Add migrations for courses/modules/cohorts/progress/submissions/lab_runs.
- Add organization scoping and route middleware design.

### Week 2: Core Services
- Build Worker APIs for cohort unlocks, progress, assignments, certificates.
- Add AI orchestration layer (`/api/ai/chat`, `/api/ai/lab`) with BYOK + fallback.
- Add org-aware theming payload endpoint.

### Week 3: Path 2 Vertical (Research)
- Implement In-Silico module pages and Experiment Lab components.
- Deploy Dr. Ada RAG tutor with citation-mode.
- Add research assignment rubric + grader endpoint.

### Week 4: Path 3 Vertical (Entrepreneurship)
- Port PhysiSciPreneur curriculum into shared course/module model.
- Build instructor studio, cohort unlock workflow, project asset saves.
- Add capstone submission + review flow.

### Week 5: Path 1 Polishing + Unified Public Funnel
- Path 1 pages, lead magnet sections, cross-track recommendation engine.
- Unify blogs/newsletter sync -> published feed cards -> track CTAs.
- Add track-wise conversion analytics to console.

### Week 6: Hardening + Launch
- Security pass (secrets, rate limits, abuse controls, API quotas).
- End-to-end tests for student/instructor/coordinator.
- Canary deploy, monitor, and production launch.

## 8) Quality Gates (Definition of Done)

- Every path must pass:
  - role-gated access checks
  - module progression checks
  - assignment submit + grade + completion checks
  - analytics event emission checks
  - AI fallback behavior checks
- Content claims must have source references in Path 2 and research blogs.

## 9) Risks and Mitigations

- Risk: model/provider instability.
  - Mitigation: AI Gateway + direct fallback + response validation.
- Risk: tenant data leakage.
  - Mitigation: org_id scoping at query layer + tests.
- Risk: parallel lane drift.
  - Mitigation: contract freeze and weekly integration checkpoints.

## 10) Immediate Next Actions

1. Approve unified D1 schema draft (I will generate migration set next).
2. Approve API contract bundle for shared worker services.
3. Start Lane B/C/D implementation branches in parallel against frozen contracts.
