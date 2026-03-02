# Incident Response Runbook

Updated: 2026-03-02

## Purpose

This runbook defines how coordinator/CTO operators triage and resolve production issues in DeepLearn.

## Severity Levels

1. `critical`
- Payment verification/webhook failures
- API auth failures for admin controls
- Certificate issuance/verification failures for completed learners

2. `warning`
- Lead capture failures
- Content generation job failures
- Counselor response pipeline failures

3. `info`
- Non-blocking operational notices

## Primary Console Views

1. `/console` -> CTO tab
- Open alerts
- Access and content ops audit

2. `/console` -> Coordinator tab
- CRM pipeline
- Cohort/session operations
- Lab ops and capstone review

## Alert Workflow

1. Detect
- Poll `GET /api/admin/alerts?status=open&limit=100`

2. Classify
- Identify source + event type
- Determine severity and learner/business impact

3. Act
- Payment incidents: validate Razorpay secret, webhook signature, and order/payment references
- CRM/funnel incidents: verify lead registration writes in `lead_registrations`
- Learning incidents: verify enrollment/module progress and assignment/certificate artifacts

4. Update status
- `POST /api/admin/alerts/:alertId/status` with:
  - `acknowledged` when triage starts
  - `resolved` after fix and verification

5. Verify recovery
- Re-run `npm run readiness:check`
- Confirm no critical open alerts remain

## Payment Failure Playbook

1. Confirm latest webhook call path:
- `/api/funnel/payment/razorpay/webhook`

2. Verify configuration:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ADMIN_API_TOKEN`

3. Validate a known lead:
- `GET /api/admin/crm/leads?q=<email_or_phone>`

4. Confirm activation:
- payment status should move to `paid`
- CRM stage should move to `won`
- enrollment should exist for user/course

## Certification Failure Playbook

1. Confirm enrollment status is completed
2. Check certificate URL in enrollment record
3. Verify with:
- `GET /api/certificates/verify?course_id=...&user_id=...`
4. If invalid/missing, re-run completion action from coordinator admin endpoint

## Post-Incident Review

Capture:
- Incident window
- Root cause
- Affected learners/leads
- Time to detect and time to recover
- Preventive action (code/config/process)
