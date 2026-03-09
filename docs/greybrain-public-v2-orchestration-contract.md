# GreyBrain Public V2 Orchestration Contract

## Objective
Ship the public-site redesign as a controlled system update, not a sequence of disconnected cosmetic edits.

This contract exists to prevent drift while redesigning `edu.greybrain.ai`.

## Non-Negotiable Outcome
The public site must feel like:
- a premium academy product
- a living AI reference system for doctors
- a modern, designed experience

It must not regress into:
- an LMS shell
- a blog homepage
- a stack of equally weighted card grids

## Workstreams
The redesign is split into parallel workstreams. Each workstream has a clear boundary.

### 1. Composition Workstream
Scope:
- section structure
- layout hierarchy
- asymmetry and spatial rhythm
- removal of repeated card-grid thinking

Owns:
- hero composition
- product-logic composition
- signal composition
- offer composition

Must not own:
- detailed course copy
- backend behavior

### 2. Surface System Workstream
Scope:
- design tokens
- radius, borders, shadows
- surface families
- motion and ambient effects

Owns:
- CSS primitives
- visual consistency
- section-level atmosphere

Must not own:
- section content strategy

### 3. Content Compression Workstream
Scope:
- reduce paragraph mass
- convert explanation into structure
- sharpen headings, subheads, and cues

Owns:
- section copy
- chip/cue language
- card density

Must not own:
- topology of the page

### 4. Illustration Workstream
Scope:
- contextual SVGs
- product diagrams
- signal/academy visuals

Owns:
- imagery that explains the product
- visual metaphors for practice/publish/build

Must not own:
- generic stock imagery

## Sequencing
These workstreams can proceed in parallel only where they do not conflict.

### Allowed in Parallel
1. Composition + surface system
2. Content compression + illustration

### Must Be Sequential
1. Hero redesign before section polish
2. Product-logic composition before signal redesign
3. Signal redesign before course-offer redesign

## Current Execution Order
### Completed
1. Hero simplification
2. Hero selector redesign
3. Hero trust strip consolidation
4. Signal-board cleanup
5. Public V2 system spec

### In Progress
1. Product-logic composition after hero
2. Signal board conversion toward a knowledge-console model

### Next
1. Replace manifesto-card pattern with one wide product-logic composition
2. Replace course grid with starter + three-offer composition

## Locked Constraints
During V2 execution:
- do not add new homepage sections
- do not add more card variants
- do not increase paragraph count to explain visual weaknesses
- do not move internal LMS/admin behavior into the public homepage

## Stop Rules
Stop and redesign if:
1. a section needs more than two paragraph blocks to explain itself
2. a section introduces a fifth public card family
3. a layout falls back to another generic grid of same-weight cards
4. imagery becomes decorative instead of explanatory

## Evidence Rules
Each major pass must include:
1. build success
2. deployed Pages preview
3. live-domain verification for the changed section text/markers

## Delivery Standard
A redesign pass is complete only when:
- the composition is visibly stronger
- the copy is shorter and clearer
- the section reads faster
- the page moves closer to the V2 system spec
