# GreyBrain "Coursera for Doctors" Blueprint

## 1) Ingestion Snapshot (Current Reality)

Based on live scraping from:
- https://greybrain.ai
- https://greybrain.ai/clinical-ai
- https://greybrain.ai/academy
- https://learn.greybrain.ai
- https://learn.greybrain.ai/sitemap.xml
- https://medium.com/feed/@ClinicalAI
- https://medium.com/feed/@GreyBrainer
- https://medium.com/feed/@Sage_AI

### Current catalog discovered
- Generative AI For Doctors - Express (`/course/gen-ai-doctors-express`)
- Generative AI For Healthcare Professionals (`/course/gen-ai-healthcare`)
- Medical Models and Data Analytics with AI (`/course/medical-models-data-analytics`)
- Super Agents: How to Hire AI to Work For You (`/course/super-agents`)
- Running Your Business with AI (`/course/ai-for-business`)
- Using AI for Academic Research and Paper Writing (`/course/ai-for-research-papers`)
- GreyBrain: NoteBook LM Presentation Manual (`/product/manual`)

### Content engine discovered
- 3 active Medium streams with frequent posting:
  - ClinicalAI (healthcare-AI)
  - GreyBrainer (lens / culture content)
  - Sage_AI (mindset / spiritual content)

### Platform capabilities already available (Fermion config)
- Courses, community, video library
- Marketing tools, forms, affiliate marketing
- Live, webhooks, bundles, gamification
- Login via email/password + Google

## 2) Strategic Positioning

### North Star
"The most trusted AI career and entrepreneurship school for healthcare professionals."

### Positioning statement
GreyBrain becomes the default learning network for doctors who want to:
- practice AI safely in clinics/hospitals
- build AI-enabled healthcare services
- become AI-first clinical leaders and founders

## 3) Coursera-Style Product Model for GreyBrain

### A. Learning units
- `Course`: 2-6 week guided program
- `Specialization`: 3-5 related courses (e.g., Clinical AI Practitioner Path)
- `Professional Certificate`: role outcomes + capstone
- `Project Sprint`: 2-5 day implementation challenge
- `Cohort Residency`: live high-touch batch for premium segment

### B. Outcome tracks (homepage-first taxonomy)
- AI for Clinical Practice
- AI for Research & Publication
- AI for Hospital Operations
- AI Entrepreneurship for Doctors
- AI Communication & Patient Education

### C. Credential strategy
- Course Certificate -> Track Certificate -> Fellowship Badge
- Verifiable public profile page with portfolio artifacts

## 4) UX/IA Plan (Two Public Experiences)

### Experience 1: Learner Growth Site (`/`)
SEO + lead magnet + enrollment.

Sections:
1. Hero: "Become an AI-enabled doctor in 90 days"
2. Live urgency strip: next cohort dates, seats left
3. "Latest Clinical AI Briefs" (auto-fed from ClinicalAI stream)
4. "Choose your goal" cards (5 outcome tracks)
5. Ongoing cohorts grid (status: Open / Filling Fast / Waitlist)
6. Proof section: learner outcomes, institutions, testimonials
7. AI Tutor demo block (guided Q&A)
8. FAQ + financing + CTA

### Experience 2: Platform/B2B (`/platform`)
Partners, institutions, investors.

Sections:
1. Platform story and market thesis
2. Capabilities (delivery, analytics, role operations)
3. Institutional offerings (hospital L&D, med colleges, associations)
4. Case studies + KPI dashboard snapshots
5. Partner CTA

### Internal route (`/console`)
Role-gated operations for coordinator, trainer, CTO.

## 5) RBAC Model (Execution Ready)

### Roles
- Visitor
- Lead (registered, not paid)
- Learner
- Alumni
- Trainer
- Course Coordinator
- Counselor (sales)
- Content Editor
- Finance Ops
- Program Director
- Platform Admin
- Super Admin

### Permission domains
- content.blog
- catalog.course
- cohort.ops
- enrollment.payment
- learning.delivery
- assignment.grading
- certificate.issue
- analytics.view
- users.roles
- platform.config
- audit.logs

### Scope keys
- `org_id` (institution)
- `course_id`
- `cohort_id`
- `user_id`

### Guardrails
- Staff routes protected by Firebase claims + server verification
- Admin APIs require signed server token
- Every sensitive action logged (role change, publish, certificate, key rotation)

## 6) Gap Analysis vs "Coursera for Doctors"

Current strengths:
- Strong clinical AI content cadence
- Real, relevant healthcare AI course topics
- Existing cohort/course infrastructure
- Multi-channel media engine

Current gaps:
- Course pages need richer conversion blocks (outcomes, duration, level, pricing clarity, reviews)
- Inconsistent information depth across courses (FAQ/syllabus uneven)
- No unified "career path" packaging yet
- Public homepage currently mixes multiple content intents
- Limited visible social proof and placement outcomes

## 7) 120-Day Build Roadmap

### Phase 1 (Days 1-30): Conversion foundation
- Launch dynamic learner homepage from live feeds/catalog
- Standardize course page template:
  - who it's for
  - outcomes
  - syllabus preview
  - duration/effort
  - pricing + seat urgency
  - testimonials
- Add "Talk to Counselor" + WhatsApp + webinar funnel

### Phase 2 (Days 31-75): Program architecture
- Introduce 3 flagship tracks:
  - Clinical AI Practitioner
  - AI Research Accelerator
  - Doctor-to-Entrepreneur AI Path
- Add capstone/project requirements and certificate hierarchy
- Add learner portfolio artifacts per module

### Phase 3 (Days 76-120): Scale and institutionalization
- B2B institution onboarding workflow
- Team analytics for hospitals/colleges
- Mentor marketplace and office-hours engine
- Alumni/referral flywheel

## 8) Landing Page Content Layout (Recommended)

H1:
"No-Code AI Courses for Doctors and Healthcare Professionals"

Subhead:
"From AI-curious to AI-confident: cohort-based training, guided AI tutor, and real clinical implementation outcomes."

Blocks:
1. Weekly Clinical AI Brief (freshness + SEO)
2. Next Cohorts (enroll now)
3. Choose Your Track (goal-first)
4. Why GreyBrain (clinical relevance + personalized AI tutor + execution support)
5. Success outcomes (jobs, promotions, clinic efficiencies, startup launches)
6. Final CTA (Enroll / Book counseling call)

## 9) KPI Targets (First 2 Quarters)

- Visitor -> lead conversion: 3-6%
- Lead -> enrollment: 8-15%
- Course completion: 60%+
- Certificate issuance: 45%+
- Referral enrollments: 15%+
- B2B pilot institutions: 3-5

## 10) Immediate Next Implementation Steps

1. Prioritize ClinicalAI stream on learner homepage (reduce non-core distraction).
2. Convert all course pages to one standard conversion schema.
3. Add Track pages + "Compare tracks" UX.
4. Implement counselor CRM-lite view in `/console` (lead stages + follow-up).
5. Publish "GreyBrain Outcomes Report" monthly for credibility and SEO.
