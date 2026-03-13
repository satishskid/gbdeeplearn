# Release Orchestration Contract

This document defines the non-drift release contract for DeepLearn.

## Objective

Ship production changes only when end-to-end gates pass with evidence.

## Workstreams (Locked)

1. **Platform stability**
   - Build succeeds.
   - Worker + Pages readiness checks pass with zero critical failures.
2. **Admin operations integrity**
   - Session CRUD smoke passes (`create -> update -> delete`) through live admin APIs.
3. **RBAC guard integrity**
   - Deployed `AuthRoleGate` bundle must include required coordinator emails.
   - Deployed bundle must not contain QA allowlist markers.

No additional scope is added during release execution.

## Enforcement Command

Run:

```bash
ADMIN_API_TOKEN=... \
DEEPLEARN_API_BASE_URL=https://deeplearn-worker.satish-9f4.workers.dev \
DEEPLEARN_PAGES_BASE_URL=https://med.greybrain.ai \
npm run release:orchestrate
```

Optional strict envs:

- `EXPECTED_COORDINATOR_EMAILS` (default: `satish@skids.health,drpratichi@skids.health`)
- `DISALLOWED_EMAIL_MARKERS` (default: `qa.coordinator.`)

## Artifacts

The orchestrator writes:

- `reports/release-gate-latest.json`
- `reports/release-gate-<timestamp>.json`

The release is **GO** only if `status = "PASS"` and all checks are `ok: true`.

## Stop Rules

1. Any failed gate blocks release.
2. No manual bypass of failed checks.
3. Fixes must be committed and gate rerun from start.
