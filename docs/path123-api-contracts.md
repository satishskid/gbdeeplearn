# Path 1/2/3 Shared API Contracts (v1 Draft)

Date: 2026-03-01  
Scope: Shared platform APIs for Productivity (Path 1), Research (Path 2), and Entrepreneurship (Path 3).

## 1. Contract Rules

- All write operations are Worker endpoints under `/api/*`.
- Admin/ops endpoints must pass `assertAdmin` (`x-admin-token`) if `ADMIN_API_TOKEN` is configured.
- Role checks are enforced in app layer (`/console`, `/learn`) and server-side for sensitive operations.
- Multi-tenant requests must include `org_id` context explicitly or derive from org-bound routes (`/:orgSlug`).

## 2. Existing Stable Endpoints

- `POST /api/chat/tutor`
- `POST /api/track`
- `POST /api/lead/submit`
- `GET /api/analytics/funnel`
- `GET|POST /api/admin/courses`
- `POST /api/admin/courses/:courseId/publish`
- `POST /api/admin/courses/:courseId/staff`
- `POST /api/admin/courses/:courseId/enroll`
- `POST /api/admin/courses/:courseId/enroll/:userId/complete`
- `GET /api/admin/courses/:courseId/enrollments`
- `POST /api/admin/content/generate-daily`
- `GET /api/admin/content/posts`
- `POST /api/admin/content/posts/:postId/status`
- `GET /api/content/posts`

## 3. Shared Endpoints (Current Build)

### 3.1 Organization and White-label

- `GET /api/admin/organizations`
- `POST /api/admin/organizations`
  - Input: `{ slug, name, brand_primary_color, logo_url }`
- `POST /api/admin/organizations/:orgId/staff`
  - Input: `{ user_id|email, role }`

### 3.2 Course Modules

- `GET /api/admin/courses/:courseId/modules`
- `POST /api/admin/courses/:courseId/modules`
  - Input: `{ module_key, title, description, sort_order, path_key, lab_type, unlock_policy, estimated_minutes }`
- `POST /api/admin/courses/:courseId/modules/:moduleId/publish`
  - Input: `{ is_published: boolean }`

### 3.3 Cohorts and Unlocks

- `GET /api/admin/cohorts?course_id=&org_id=`
- `POST /api/admin/cohorts`
  - Input: `{ course_id, org_id, name, mode, start_date, end_date, instructor_user_id, fee_cents }`
- `POST /api/admin/cohorts/:cohortId/unlocks`
  - Input: `{ module_id }`
- `GET /api/admin/cohorts/:cohortId/unlocks`
- `POST /api/admin/cohorts/:cohortId/enroll`
  - Input: `{ user_id?, email?, display_name?, status? }`
- `GET /api/admin/cohorts/:cohortId/enrollments`
- `POST /api/admin/cohorts/:cohortId/enroll/:userId/complete`
  - Input: `{ certificate_url? }`

### 3.4 Learner Progress and Assessments

- `POST /api/learn/modules/:moduleId/progress`
  - Input: `{ course_id, cohort_id, status, score, artifact_url, notes }`
- `GET /api/admin/courses/:courseId/rubrics`
- `POST /api/admin/courses/:courseId/rubrics`
  - Input: `{ module_id, title, pass_threshold, rubric }`
- `POST /api/admin/rubrics/:rubricId`
  - Input: `{ title?, pass_threshold?, rubric? }`
- `POST /api/learn/assignments/:moduleId/submit`
  - Input: `{ course_id, rubric_id, answer_text, artifacts_json }`
- `POST /api/learn/assignments/:submissionId/grade`
  - Input: `{ groq_key? }`

### 3.5 Labs and Telemetry (Path 2/3)

- `POST /api/lab/run`
  - Input: `{ course_id, module_id, path_key, tool_type, provider, model_name, input }`
- `POST /api/events/learning`
  - Input: `{ course_id, module_id, cohort_id, event_name, event_value, metadata }`
- `POST /api/events/assessment`
  - Input: `{ course_id, module_id, cohort_id, event_name, score, passed, metadata }`

## 4. Shared Response Envelope

For new endpoints, use:

```json
{
  "ok": true,
  "data": {}
}
```

Errors:

```json
{
  "error": "message",
  "details": "optional details"
}
```

## 5. Cross-Path Mapping

- Path 1 (Productivity): `path_key="productivity"`
- Path 2 (Research): `path_key="research"`
- Path 3 (Entrepreneurship): `path_key="entrepreneurship"`

Every module, lab run, and event should carry `path_key` for reporting and adaptive recommendations.
