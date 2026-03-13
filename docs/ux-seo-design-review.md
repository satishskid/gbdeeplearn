# UX + SEO Design Review (Public Site vs Internal LMS)

## Product Split (Final IA)

### 1) Public Site (`/`, `/courses`, `/tracks`)
- Purpose: attract doctors, educate, and convert to enrollment.
- Must show:
  - market positioning and outcomes,
  - latest insights/blog feed,
  - simplified "AI basics" trust-building section,
  - tracks + course catalog + enrollment CTA,
  - AI counselor and lead capture form.
- Must NOT show:
  - internal operations controls,
  - grading/admin controls,
  - raw API or token management forms.

### 2) Internal LMS App (`/learn`, `/console`)
- Purpose: delivery and operations.
- `/learn`: learner pre-reads, sessions, assignments, capstone, certificate, protected AI tutor.
- `/console`: coordinator/teacher/counselor/CTO operations and CRM.

## Header Strategy
- Public nav:
  - Home, Courses, Paths, Insights, Learner Login
- App nav:
  - Learner Hub, Team Console, Public Site
- Rationale: avoids mixing conversion UX with administrative workflows.

## Tutor Settings (What belongs in a modal)
- BYOK key (local browser storage only).
- Current context/module id for RAG focus.
- Mode transparency (BYOK active vs server fallback).
- Keep this out of homepage; only in authenticated learner experience.

## SEO Direction
- Canonical uses `https://med.greybrain.ai`.
- Keep high-intent phrases in headings and metadata:
  - AI courses for doctors,
  - healthcare AI training,
  - clinical AI productivity,
  - AI research for clinicians,
  - doctor entrepreneurship.
- Structured data: `EducationalOrganization` + `Course` list.
- Insight feed section on homepage for freshness signals.

## Conversion Journey
1. Blog/SEO discovery -> homepage.
2. "Decode AI" trust section lowers entry barrier.
3. Track/course exploration.
4. Counselor Q&A + webinar lead form.
5. Enroll.
6. Learner Hub unlock.

