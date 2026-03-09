# AI Refresher For Doctors Blueprint

## Positioning

### Product line
AI Refresher For Doctors

### Core promise
A short interactive orientation that shows doctors how AI turns prompts into clinical, academic, and venture outputs.

### What it is
- A registration-gated starter experience.
- A bridge between curiosity and the full GreyBrain pathways.
- A clinician-first orientation for individuals, departments, and medical colleges that want sensitization before a deeper program.

### What it is not
- A passive webinar replay.
- A coder-facing deep learning course.
- A long certificate program.
- A generic "AI basics" module with no outcome routing.

## Target Audiences

### Primary
- Doctors who are AI-curious but not yet implementation-ready.
- Residents and faculty who want a low-friction first step before Path 2.
- Clinician-founders or operators who need conceptual clarity before Path 3.

### Institutional
- Medical colleges seeking a sensitization layer before workshops or full cohorts.
- Departments that want to onboard groups into a common AI vocabulary.

## Strategic Role In The Academy

The refresher should do four things well:
1. Lower fear and technical intimidation.
2. Make AI feel legible and practical.
3. Demonstrate real outputs across practice, publication, and venture building.
4. Route the learner into the correct full cohort.

If it does not do all four, it becomes dead content instead of a conversion-grade orientation.

## Learning Outcome

By the end of the refresher, the learner should be able to:
- Explain the difference between prompt, context, model, review, and output.
- Recognize why grounded context changes answer quality.
- Understand why fluent output still needs clinician review.
- Identify practical AI use-cases in clinical work, research, and venture design.
- Choose the most relevant GreyBrain path: Practice, Publish, or Build.

## Experience Shape

### Duration
- 20 to 30 minutes total.
- Six short chapters.
- Each chapter should take roughly 3 to 5 minutes.

### Screen pattern
Every chapter should follow the same structure:
1. One question.
2. One visual explainer.
3. One interactive demo.
4. One doctor-facing example.
5. One takeaway.

### Delivery pattern
- Lightweight animation, not heavy video dependence.
- Short intro clips are acceptable.
- The core persuasion must come from interaction, comparison, and feedback.

## Curriculum

## Chapter 1: Prompt To Answer

### Question
What is AI actually doing when I type something?

### Teaching point
AI output quality is strongly shaped by instruction quality.

### Interactive demo
- The learner enters or selects a weak prompt.
- The system shows a weak output.
- The learner then adds:
  - role,
  - task,
  - output format.
- The output updates and improves.

### Doctor-facing example
Discharge summary to patient-friendly explanation.

### Takeaway
Better prompts do not make AI smarter. They make the task clearer.

## Chapter 2: Why Context Matters

### Question
Why does AI sometimes sound right but still fail?

### Teaching point
Context is what turns generic generation into grounded assistance.

### Interactive demo
The same question is asked in three modes:
- no context,
- one source attached,
- syllabus or guideline attached.

The learner sees the answer become more specific and reliable.

### Doctor-facing example
Extracting inclusion criteria from a clinical protocol.

### Takeaway
Context is the difference between guessing and grounded output.

## Chapter 3: How Models Work Without The Jargon

### Question
What sits between the prompt and the answer?

### Teaching point
Large language models do not "understand" in the human sense. They process token sequences, use learned patterns, and predict what is likely to come next.

### Interactive demo
- token-by-token generation,
- simple next-token probability bars,
- temperature slider showing stable vs creative vs messy outputs.

### Doctor-facing example
The same instruction rendered at different temperatures for patient communication vs idea generation.

### Reference inspiration
- Illustrated GPT-2 style token flow.
- nanoGPT style next-token intuition.
- Transformer explainer inspiration without mathematical overload.

### Takeaway
Fluent output comes from prediction and patterning, not clinical judgment.

## Chapter 4: Why Review Still Matters

### Question
Why can an answer sound good and still be unsafe?

### Teaching point
AI can produce persuasive errors. Review is a necessary human layer, not an optional one.

### Interactive demo
The learner is shown a fluent output with hidden problems and asked to identify:
- unsupported claims,
- missing cautions,
- overconfident language,
- weak sourcing.

### Doctor-facing example
Patient instructions, research summary, or startup claim with one critical issue embedded.

### Takeaway
AI drafts. Doctors decide.

## Chapter 5: What Good Outputs Look Like

### Question
What can AI actually produce for my work?

### Teaching point
The same AI foundations create different outputs depending on the workflow.

### Interactive demo
Three lanes:
- Practice
- Publish
- Build

Each lane should include two examples.

### Example outputs
Practice:
- clinic note to patient instructions,
- OPD visit note to follow-up checklist.

Publish:
- paper to poster outline,
- reviewer comments to response matrix.

Build:
- clinical pain point to MVP brief,
- audit finding to pilot hypothesis.

### Takeaway
AI value becomes real when outputs are tied to a workflow, not to novelty.

## Chapter 6: Choose Your Path

### Question
Which GreyBrain path fits me now?

### Teaching point
The refresher is a sorting layer, not the destination.

### Interactive demo
Mini diagnostic using two variables:
- what outcome matters most,
- what stage the learner is currently at.

### Output
Recommended path with rationale:
- Practice for clinical productivity,
- Publish for research and academic acceleration,
- Build for entrepreneurship and venture design.

### Takeaway
The learner leaves with clarity on the next cohort, not just a sense of completion.

## Motion And Visual Direction

### Product feel
- More like a clinical intelligence instrument than a course slideshow.
- Crisp transitions, not playful animation.
- Functional visual metaphors: token flow, grounded context, output comparison, review markers.

### Visual motifs
- Prompt pipeline.
- Context panel.
- Token stream.
- Review highlights.
- Outcome lane switcher.

### Avoid
- cartoon AI imagery,
- decorative 3D blobs,
- engineer-facing matrices and charts without interpretation.

## UX Principles

- One concept per screen.
- One interaction per screen.
- Immediate visible change when the learner interacts.
- Every concept anchored in a doctor-facing example.
- Every chapter ends with a clear takeaway sentence.

## Content Principles

- No hype.
- No vague claims about "AI revolutionizing healthcare."
- No heavy deep learning jargon unless it is translated into a clinician-friendly analogy.
- The learner should feel more oriented, not more overwhelmed.

## Conversion Logic

### Entry
- Unlock after registration.
- Also usable as a campus or webinar follow-up asset.

### Exit
- Show path recommendation.
- Offer a relevant next cohort.
- Offer counselor support if the learner is unsure.

### Why it converts
It converts because it gives the learner three things:
- clarity,
- visible usefulness,
- an obvious next step.

## Institutional Use Case

For medical colleges, the refresher can serve as:
- a pre-webinar primer,
- a post-webinar consolidation layer,
- a faculty sensitization module,
- an orientation before departmental cohorts.

This makes it useful beyond direct consumer enrollment.

## Implementation Notes For GreyBrain

### Phase 1
- Ship as a structured course page with clear chapter architecture.
- Use existing registration gate.
- Route the learner to `/tracks` and cohort enrollment.

### Phase 2
- Add lightweight interactive demos for each chapter using React islands.
- Persist completion locally or in Firestore.
- Unlock path recommendation card at the end.

### Phase 3
- Add cohort-specific follow-through:
  - Path 1 recommended next actions,
  - Path 2 reading pack,
  - Path 3 venture starter brief.

## Success Metrics

- Registration to refresher start rate.
- Refresher completion rate.
- Refresher to cohort click-through rate.
- Path recommendation distribution.
- Counselor engagement after refresher.

## Product Standard

The refresher should leave the learner saying:
- I understand the moving parts now.
- I saw how AI applies to my kind of work.
- I know which GreyBrain path I should take next.
