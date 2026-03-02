# Production Readiness Checklist

Updated: 2026-03-02

## Scope

This checklist covers Path 1, Path 2, and Path 3 operations on the shared platform:
- Public lead funnel and payment flow
- Internal CRM and coordinator operations
- Learning delivery (sessions, assignments, capstone, certification)
- Daily content pipeline
- Alerts and operational response

## Critical Go-Live Gates

1. Platform health and API availability
- [ ] `GET /health` returns `ok`
- [ ] `GET /api/admin/overview` works with `x-admin-token`
- [ ] `GET /api/admin/crm/leads` returns records

2. Access control and role policy
- [ ] `ADMIN_API_TOKEN` is set in Worker secrets
- [ ] `ENFORCE_FIREBASE_AUTH=true` for learner endpoints
- [ ] Access audit reviewed (`GET /api/admin/access/audit`)

3. Course operations
- [ ] At least one live/open cohort per active course path
- [ ] Session planner tested (`/api/admin/cohorts/:cohortId/sessions`)
- [ ] Attendance update tested (`/api/admin/sessions/:sessionId/attendance`)

4. Lead and payment lifecycle
- [ ] Lead capture works (`/api/lead/submit`)
- [ ] Payment order creation works (`/api/funnel/payment/create-order`)
- [ ] Razorpay webhook signature verification works
- [ ] CRM stage updates work (`POST /api/admin/crm/leads/:leadId`)

5. Learning and completion lifecycle
- [ ] Learner can submit assignment
- [ ] Assignment grading returns pass/fail
- [ ] Completion triggers certificate artifact issuance
- [ ] Certificate verification succeeds (`/api/certificates/verify`)

6. Content and SEO
- [ ] Daily draft generation works (`/api/admin/content/generate-daily`)
- [ ] Content runs visible (`/api/admin/content/runs`)
- [ ] `robots.txt` and `sitemap.xml` are reachable

7. Monitoring and incident response
- [ ] Open alerts visible (`/api/admin/alerts`)
- [ ] Alert status workflow tested (acknowledge/resolve)
- [ ] Payment failure creates an alert
- [ ] Team has reviewed `docs/incident-response-runbook.md`

## Automated Check

Run:

```bash
ADMIN_API_TOKEN=... \
DEEPLEARN_API_BASE_URL=https://deeplearn-worker.satish-9f4.workers.dev \
npm run readiness:check
```

Optional Pages checks:

```bash
DEEPLEARN_PAGES_BASE_URL=https://<pages-domain> npm run readiness:check
```

If `critical_failures > 0`, do not mark go-live complete.
