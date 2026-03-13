# GreyBrain Public Site V2 System Spec

## Objective
Redesign `med.greybrain.ai` so it no longer feels like a content page assembled from cards. The public site should feel like a premium academy product for doctors entering the AI era.

This is not a “homepage refresh.” It is a system redesign for the public-facing experience.

## Strategic Positioning
GreyBrain is:
- the AI academy for doctors who want to practice, publish, and build
- a guided learning product
- a living AI reference system for clinicians

GreyBrain is not:
- a generic blog
- a dashboard disguised as a website
- a SaaS landing page with healthcare wording
- a content dump

## Reference Takeaways
From strong systems like Visa Design:
- strict token discipline
- component consistency
- fewer primitives, used more intentionally
- patterns first, one-off sections second

From the better Astro showcase sites:
- stronger visual conviction
- fewer boxes
- more atmosphere and motion
- section compositions, not repeated card grids
- one dominant narrative per viewport

## Current Problems
### Visual
- too many bordered containers
- too many sections with equal weight
- too many local styling decisions instead of system rules
- too much text in places where layout should carry meaning

### Structural
- the homepage still behaves like:
  - hero
  - card block
  - card block
  - card block
- the signal board still competes with the course area
- the course area still reads like a catalog grid, not a premium offer stage

### Content
- some sections still explain instead of showing
- too many paragraphs are carrying product meaning
- the page still drifts back toward editorial/news behavior in some areas

## V2 Design Principles
1. One dominant idea per section.
2. Fewer visible borders; more spacing, contrast, and background layering.
3. Every section must have a clear visual job.
4. Images and illustrations must explain the product, not decorate it.
5. Repeated card grids should be replaced with stronger compositions.
6. Typography should carry hierarchy, not compensate for layout weakness.

## Visual System
### Palette
- `Cortex Navy`: hero, dark surfaces, product authority
- `Clinical Ivory`: primary page background
- `Signal Teal`: practice/accent
- `Research Blue`: publish/accent
- `Venture Amber`: build/accent
- `Trust Green`: certification and safe recognition moments only

### Surface Model
Use only three surface families:
1. `Dark Hero Surface`
2. `Light Editorial Surface`
3. `Tinted Accent Surface`

Do not keep inventing new white-card variants section by section.

### Border Rules
- visible border only where it improves grouping
- prefer 8-12% alpha borders
- eliminate decorative borders from at least 40% of current containers

### Radius Rules
- `1rem` small interactive controls
- `1.5rem` cards and panels
- `2rem` hero and major composition shells

### Shadow Rules
- subtle, deep shadows
- no “floating app card” shadows on every section
- use shadow only on active/focused or premium surfaces

## Typography Rules
### Heading
- `Outfit` remains primary
- large headline compression with tight tracking

### Editorial emphasis
- `Cormorant Garamond` only for rare emphasis in hero or manifesto language
- never for whole paragraphs

### Body
- `Plus Jakarta Sans`
- line length must stay controlled; do not allow wide explanatory paragraphs

### Mono
- use only for metadata, workflow labels, and small system cues

## Motion Rules
### Allowed
- slow ambient scan
- subtle orbiting/product-core motion
- reveal-up on sections
- low-amplitude hover response
- directional beam/flow animation in product diagrams

### Avoid
- decorative motion without informational value
- multiple simultaneous competing animations in the same viewport
- motion that makes the page feel playful rather than precise

## Image Strategy
The site needs more contextual imagery, but not stock healthcare photos everywhere.

### Use image types
1. Product illustrations
   - note -> patient instruction
   - paper -> evidence map
   - problem -> pilot brief
2. Interface-style diagrams
   - prompt -> context -> tutor -> review -> output
3. Sparse clinical stills
   - only where human credibility helps
4. Abstract signal textures
   - to give atmosphere to large sections

### Do not use
- generic smiling-doctor stock art
- decorative AI robots
- filler image banners

## Homepage V2 Composition Model
The homepage should become five compositions, not a stack of section templates.

### 1. Hero Composition
Job:
- define the academy
- show the workflow
- let the user choose path intent

Elements:
- headline
- path selector
- workflow diagram
- trust strip

Do not add more content to the hero.

### 2. Product Logic Composition
Replace manifesto-card thinking with one wide product logic stage.

Job:
- show how GreyBrain works without essay-style copy

Structure:
- left: short positioning statement
- right: horizontal system map
  - prompt
  - context
  - tutor
  - review
  - output

This should feel like a designed product explanation, not three opinion cards.

### 3. Three-Path Composition
Job:
- show the three visible futures for the learner

Structure:
- three large path panels
- each panel contains:
  - one visual
  - one audience line
  - one transformation
  - one CTA

Current path panels are directionally right, but still too card-like.

### 4. Signal Composition
Job:
- make the site feel alive and current
- support repeat visits

Structure:
- one featured signal
- one workflow highlight
- one wiki highlight
- one model watch highlight

Not:
- lead news card + side news column + more card columns

The signal stage should feel like a knowledge console, not a blog index.

### 5. Offer Composition
Job:
- present the commercial learning offers

Structure:
- one featured starter offer: refresher
- three cohort offers:
  - practice
  - publish
  - build
- one “compare all” action

Do not lead with six similar course cards.

### 6. Enrollment Composition
Job:
- remove friction
- explain the next step simply

Structure:
- starter/refresher entry
- cohort enrollment
- counselor support

This section should be compact and decisive.

## Component Rules
### Public Card Families
Only four card families should exist publicly:
1. `Hero selector card`
2. `Path panel`
3. `Signal card`
4. `Course offer card`

Everything else should derive from these.

### Chips
Use chips only for:
- path classification
- content type
- short support cues

Do not use chips as a substitute for missing hierarchy.

### CTAs
Only three CTA styles:
1. Primary dark
2. Secondary outline
3. Text/action link

## Content Rules
### Replace paragraphs with:
- one-line positioning
- one-line transformation
- structured cues
- chips
- visual examples

### Every section must answer:
- what is this?
- why should a doctor care?
- what changes for me?

### Every card must have one job:
- explain
- signal
- convert
- route

If a card is doing more than one job, split or reduce it.

## Specific V2 Changes Recommended
### Remove or reduce
- repeated white card treatments
- equal-weight section headers everywhere
- large editorial lead-card behavior in the signal area
- oversized course grid density

### Introduce
- one stronger product-logic section after hero
- one more premium course-offer stage
- one more visual signal stage
- stronger asymmetry in section layouts

## Implementation Order
### Phase 1
- lock design tokens and component families
- stop adding one-off visual styles

### Phase 2
- rebuild hero and trust strip
- done partially; refine only, do not expand

### Phase 3
- rebuild post-hero manifesto into a product-logic composition

### Phase 4
- rebuild signal stage into a 2x2 knowledge console

### Phase 5
- rebuild course area into starter + three-offer composition

### Phase 6
- compact enrollment/counselor stage

## Non-Negotiables
- public site must feel premium and modern
- no internal-tool visual language on homepage
- no generic health-tech design clichés
- no repeated card-grid thinking as the default solution
- no new sections without a clear visual job

## Final Standard
The page should feel like:
- a serious academy
- a product experience
- a current AI reference system

It should not feel like:
- a 1990s brochure
- a blog homepage
- an LMS admin shell

Build the public-facing academy for ambitious doctors entering the AI era.
