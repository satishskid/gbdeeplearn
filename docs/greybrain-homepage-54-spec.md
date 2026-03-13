# GreyBrain Academy Homepage Spec (GPT-5.4 Direction)

## Positioning

### Core line
The AI Academy for Doctors Who Want To Practice, Publish, and Build.

### What the homepage must do
- Establish GreyBrain as the premium AI learning destination for doctors and healthcare professionals.
- Lower the barrier to entry for clinicians who are AI-curious but not technical.
- Show that GreyBrain is not just "AI education"; it is an implementation academy.
- Route visitors into one of three clear outcome paths:
  - clinical productivity,
  - research and academic acceleration,
  - entrepreneurship and venture building.
- Convert visitors into:
  - course enrollees,
  - newsletter subscribers,
  - counselor-assisted qualified leads.

### What the homepage must not feel like
- a SaaS admin dashboard,
- a wellness clinic,
- a generic AI startup landing page,
- a course marketplace clone with too many small cards,
- an internal ERP interface.

### Emotional target
Visitors should feel:
- "This is made for doctors, not coders."
- "AI is learnable and practical."
- "There is a real pathway from curiosity to capability."
- "GreyBrain has intellectual authority, not just marketing polish."

## Brand Direction

### Visual identity
GreyBrain should feel like:
- clinical intelligence journal,
- modern AI command center,
- cohort-based academy for ambitious doctors.

This is not organic luxury. It is editorial, precise, intelligent, and high-trust.

### Design keywords
- cerebral
- editorial
- clinical
- modern
- weighted
- trustworthy
- ambitious

## Design System

### Palette
- `Cortex Navy`: `#0C1626`
- `Clinical Ivory`: `#F5F3EC`
- `Slate Ink`: `#1B2430`
- `Signal Teal`: `#2FA8A0`
- `Research Blue`: `#3D7BE0`
- `Venture Amber`: `#C9812B`
- `IIHMRB Green Accent`: `#2E7D5A`
- `Line Soft`: `rgba(12, 22, 38, 0.10)`

### Typography
- Primary sans: strong geometric or humanist sans with editorial sharpness.
- Accent serif: used sparingly for emphasis words like `practice`, `publish`, `build`, `research`, `venture`.
- Monospace: used only for telemetry, AI pipeline labels, and micro-data.

### Type behavior
- Headlines should be dense and confident, not airy.
- Section subheads should read like editorial standfirsts.
- Supporting copy should use fewer lines and tighter message discipline.

### Shape language
- Large rounded containers: `rounded-[2rem]` to `rounded-[2.75rem]`
- Smaller internal modules: `rounded-[1.25rem]` to `rounded-[1.5rem]`
- Borders should be subtle and structural, not decorative.

### Texture
- Global low-opacity noise overlay to reduce flat gradients.
- Occasional scanline or grid texture in dark sections.
- No gratuitous abstract blobs.

## Information Architecture

### Public navigation
- Home
- Paths
- Cohorts
- Briefs
- Courses
- Login

### Public homepage structure
1. Hero
2. Why GreyBrain / Decode AI
3. Three Outcome Paths
4. Living Intelligence Feed
5. Current Cohorts
6. Enrollment + Newsletter
7. AI Counselor
8. Footer

### Separation principle
The homepage is public and conversion-focused.
Operational controls remain in the internal LMS and console.

## Homepage Narrative

### Act 1: Identity and ambition
The visitor should immediately understand:
- this is AI education for doctors,
- it leads to practice, publication, and venture outcomes,
- it is cohort-based and implementation-focused,
- it carries recognized certification.

### Act 2: Lower the cognitive barrier
Most doctors are not blocked by lack of ambition. They are blocked by perceived complexity.
The site must explain AI in a way that feels understandable and clinically relevant.

### Act 3: Present the three paths
The three paths are the core product architecture.
They should be framed as career outcomes, not feature lists.

### Act 4: Show proof of freshness and relevance
The blog feed and model watch should signal:
- GreyBrain is current,
- GreyBrain tracks the AI frontier,
- GreyBrain translates novelty into usable physician workflows.

### Act 5: Convert
Enrollment, newsletter subscription, and counselor guidance should be clean and compact.
They support the main story. They do not become the story.

## Section-by-Section Spec

## 1. Hero

### Purpose
State the positioning and route the user into the right track.

### Layout
- Full-height or near-full-height hero.
- Left-heavy composition.
- One signature visual artifact on the right.
- Floating navbar that morphs on scroll.

### Content
- Eyebrow: `GreyBrain Academy`
- Trust badge: `IIHMRB Certified`
- Headline:
  - `Become an AI-enabled Doctor,`
  - `Researcher, or Founder`
- Supporting copy:
  - cohort-based,
  - AI tutor support,
  - mentor-reviewed assignments,
  - implementation-first learning for healthcare professionals.

### CTAs
- Primary: `Explore Paths`
- Secondary: `View Current Cohorts`

### Hero artifact
Replace generic visual noise with one "AI learning instrument":
- `Prompt -> Model -> Context -> Review -> Outcome`

The right-side artifact should animate through:
- a clinical workflow output,
- a research output,
- a venture output.

This is the homepage's signature visual identity.

## 2. Decode AI

### Purpose
Reduce fear and complexity for clinicians.

### Headline
`AI is not magic. It is a workflow.`

### Structure
Use a horizontal sequence of five micro-panels:
- Prompt
- Context
- Model
- Review
- Output

### Copy goal
Explain AI in clinician-friendly language:
- prompt = the instruction,
- context = the reference material,
- model = the reasoning engine,
- review = the human judgment layer,
- output = the usable draft, summary, protocol, or idea.

### Why this matters
This section is trust-building and SEO-friendly.
It targets high-intent visitors searching for:
- AI basics for doctors,
- prompt engineering for clinicians,
- how doctors can use AI,
- healthcare AI training.

## 3. The Three Outcome Paths

### Purpose
Turn a broad audience into three clear self-selections.

### Card architecture
Use three large path panels, not small cards.
Each path needs:
- who it is for,
- what it helps them become,
- 3 example outcomes,
- 1 CTA.

### Path 1
Clinical Productivity
- For doctors who want immediate workflow leverage.
- Outcomes:
  - documentation,
  - communication,
  - clinical workflow support.
- CTA: `Explore Clinical Productivity`

### Path 2
Research and Academic Acceleration
- For residents, faculty, and academic clinicians.
- Outcomes:
  - literature review,
  - manuscript drafting,
  - reviewer responses,
  - study design acceleration.
- CTA: `Explore Research Accelerator`

### Path 3
Entrepreneurship and Venture Building
- For clinician-founders and operators.
- Outcomes:
  - problem validation,
  - no-code MVP planning,
  - pilot design,
  - capstone-to-venture readiness.
- CTA: `Explore Venture Builder`

### Interaction model
- Large tab or switcher logic is acceptable.
- Do not hide all three paths completely.
- The user should see the existence of all three at once.

## 4. Living Intelligence Feed

### Purpose
Make the site feel current, authoritative, and worth revisiting.

### Structure
This should be a dense editorial strip, not oversized floating cards.

Split into two rails:
- `Clinical AI Briefs`
- `Model Watch`

Optionally a third rail:
- `Research and Venture Signals`

### Content sources
- Medium feed from `@ClinicalAI`
- Hugging Face trending models
- GreyBrain-curated categorizations by path

### Card style
- compact editorial cards,
- date,
- label,
- one readable paragraph,
- one CTA.

### Rules
- avoid tall empty cards,
- avoid giant white gaps,
- cards should feel like premium abstract cards or journal snippets.

## 5. Current Cohorts

### Purpose
Show what is immediately joinable without overwhelming with details.

### Content
Each cohort card shows:
- path label,
- course title,
- short one-line promise,
- next intake timing,
- CTA to course detail.

### Visual treatment
- denser than current version,
- no tall cards,
- horizontal motion can remain but should feel deliberate and slow.

## 6. Enrollment + Newsletter

### Purpose
Provide lightweight conversion without dominating the page.

### Layout
One horizontal section:
- left: enrollment,
- right: newsletter subscription.

### Enrollment
- headline: `Start Enrollment`
- subcopy: Google-based onboarding into learner access and cohort journey.
- action: `Continue with Google`

### Newsletter
- headline: `Subscribe`
- subcopy: daily AI model and clinical workflow updates.
- actions:
  - WhatsApp icon
  - Telegram icon

### Important rule
This section should be compact, premium, and quiet.
It is a conversion utility, not a hero.

## 7. AI Counselor

### Purpose
Help undecided visitors self-qualify.

### UX direction
Primary mode should be structured FAQ exploration.
Freeform chat is secondary.

### UI
- grouped FAQ chips:
  - Path 1
  - Path 2
  - Path 3
  - Fees and schedule
  - Certification
  - Format and prerequisites
- clicking a chip expands the answer,
- answer includes a `Use in Chat` action,
- manual typing stays available below.

### Content source
- admin-managed counselor FAQ/rules,
- path-specific defaults,
- program USP,
- logistics context from vectorized docs.

## 8. Footer

### Purpose
Close with clarity and institutional trust.

### Include
- path links
- course links
- learner login
- certification link
- newsletter links
- system status / academy live indicator

### Tone
Editorial and restrained, not corporate filler.

## Motion System

### Principles
- every motion must communicate structure,
- use slow weighted transitions,
- avoid excessive bounce,
- prefer reveal, sweep, morph, and stack interactions.

### Recommended motion vocabulary
- floating nav morph on scroll
- staggered headline reveal in hero
- instrument-like animation in hero artifact
- tab or track switch transitions for path cards
- slow marquee for briefs and cohorts
- chip expansion for counselor FAQs

### What to avoid
- random particle effects,
- decorative binary rain that does not serve the narrative,
- childish icon motion,
- too many simultaneously moving areas.

## SEO Strategy

### Primary keywords
- AI courses for doctors
- healthcare AI training
- clinical AI course
- AI research course for doctors
- entrepreneurship course for doctors
- no-code AI for healthcare professionals

### Section-level search intent mapping
- Hero: AI courses for doctors
- Decode AI: AI basics for doctors / how doctors use AI
- Paths: clinical AI / AI research / healthcare entrepreneurship
- Briefs: freshness and topical authority
- Cohorts: conversion and program discovery

### Metadata direction
- Homepage title:
  - `GreyBrain Academy | AI Courses for Doctors to Practice, Publish, and Build`
- Homepage meta description:
  - `Cohort-based AI learning for doctors and healthcare professionals across clinical productivity, research acceleration, and venture building.`

### Structured data
- `EducationalOrganization`
- `Course`
- `FAQPage`
- `EducationalOccupationalCredential`

## Content Tone

### Writing style
- precise
- clinician-facing
- intelligent but accessible
- no hype language
- no startup cliches

### Message priorities
- implementation over theory
- clinicians, not coders
- outcomes over features
- trust over noise

## Technical Implementation Plan

## Phase 1
- establish new design tokens in `global.css`
- redesign navbar
- rebuild hero
- rebuild path switcher into stronger outcome architecture

## Phase 2
- implement `Decode AI` section
- redesign insight rail into compact editorial feed
- reduce empty space and card drift

## Phase 3
- redesign current cohorts section
- compact enrollment + newsletter block
- restructure AI counselor into categorized explorer

## Phase 4
- refine motion system
- tighten mobile layout
- finalize SEO metadata and structured data

## Non-Negotiables
- public site must feel premium and modern,
- no internal-tool visual language on homepage,
- no generic AI startup tropes,
- no oversized empty containers,
- the three paths must remain the core organizing system,
- SEO must be built into section architecture, not added at the end.

## Implementation North Star
Do not build a generic course site.
Build the public-facing academy for ambitious doctors entering the AI era.
