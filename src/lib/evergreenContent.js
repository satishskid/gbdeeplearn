export function getEvergreenSeedEntries() {
  return [
    {
      slug: 'workflow-paper-to-family-brief',
      title: 'Workflow: Turn a clinical paper into a family-ready explanation',
      summary:
        'A reusable doctor-facing workflow for translating dense study findings into plain-language communication without diluting evidence.',
      path: 'productivity',
      content_type: 'workflow',
      tags: ['workflow', 'patient-communication', 'clinical-ai'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## When to use this
Use this workflow when you need to explain a published study to a patient or family without importing unnecessary jargon.

## Workflow
- Identify the question the study actually answered.
- Extract only the findings that matter for the patient's real decision.
- Translate the result into plain language without overstating certainty.
- Add one caution or limitation before sharing.

## Prompt
\`I am a physician. Based on the attached clinical study, create: 1) a three-point plain-language summary for a patient's family, 2) two direct data-backed insights, 3) one limitation that should still be explained clearly.\`

## Review checklist
- Does the summary stay faithful to the actual data?
- Is the patient implication separated from speculation?
- Is any uncertainty made explicit?`
    },
    {
      slug: 'wiki-what-is-rag-for-doctors',
      title: 'Wiki: What is RAG, and why should doctors care?',
      summary:
        'A clinician-first explanation of retrieval-augmented generation and why grounded context matters more than raw model fluency.',
      path: 'research',
      content_type: 'wiki',
      tags: ['wiki', 'rag', 'ai-basics'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## Definition
Retrieval-augmented generation, or RAG, means the model does not rely only on its training memory. It first pulls relevant source material, then writes from that context.

## Why it matters in medicine
Doctors do not need eloquent answers alone. They need answers tied to a guideline, paper, protocol, or teaching module.

## Practical effect
Without retrieval, the model may sound confident but improvise. With retrieval, the model has a bounded evidence frame and can be checked against a real source.

## Clinical analogy
Think of RAG as asking a registrar to answer with the chart open, not from memory alone.`
    },
    {
      slug: 'model-watch-clinical-multimodal-models',
      title: 'Model Watch: What to look for in a clinical multimodal model',
      summary:
        'A practical framework for doctors tracking new multimodal models without confusing leaderboard hype for workflow value.',
      path: 'research',
      content_type: 'model_watch',
      tags: ['model-watch', 'multimodal', 'research-ai'],
      source_urls: ['https://huggingface.co/models'],
      content_markdown: `## What matters first
Do not start with the benchmark headline. Start with the task.

## Questions to ask
- Can the model handle the actual data modality you work with?
- Can it explain where an answer came from?
- Can it stay grounded to reference context?
- What fails first when inputs become messy or incomplete?

## Doctor's rule
A model is useful when it improves a real workflow with bounded risk, not when it simply performs well on a public leaderboard.

## Use in GreyBrain
Model watch notes should help doctors decide what to test, what to ignore, and what to wait on.`
    },
    {
      slug: 'workflow-reviewer-comments-to-response-matrix',
      title: 'Workflow: Turn reviewer comments into a response matrix',
      summary:
        'A structured AI-assisted workflow for moving from reviewer comments to a defendable revision plan and response letter.',
      path: 'research',
      content_type: 'workflow',
      tags: ['workflow', 'peer-review', 'manuscript'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## Goal
Convert reviewer feedback into a manageable revision system.

## Workflow
- Group comments by methods, claims, results, and presentation.
- Mark which comments require manuscript changes versus explanation only.
- Draft one evidence-backed response per comment.
- Build a revision tracker before editing the manuscript.

## Prompt
\`Act as a research editor. Turn these reviewer comments into a response matrix with: concern, underlying issue, manuscript action, evidence needed, and draft response.\`

## Why this matters
Doctors often lose time in revision because they respond line by line without first structuring the work.`
    },
    {
      slug: 'wiki-what-is-a-model-card',
      title: 'Wiki: What is a model card?',
      summary:
        'A simple explanation of model cards for clinicians who need to judge applicability, bias, and deployment risk.',
      path: 'entrepreneurship',
      content_type: 'wiki',
      tags: ['wiki', 'model-card', 'ai-governance'],
      source_urls: ['https://huggingface.co/docs/hub/model-cards'],
      content_markdown: `## Definition
A model card is a short document that explains what a model is for, how it was trained, where it performs well, and where it may fail.

## Why doctors should care
Before using a model in research, care delivery, or a startup workflow, you should know its intended use, training data limitations, and bias risks.

## Clinical analogy
It is similar to reading the prescribing information before using a drug. You want indications, cautions, and known limitations, not just enthusiasm.

## Rule for GreyBrain learners
Never evaluate a model only by demos. Read the model card first.`
    },
    {
      slug: 'workflow-clinical-problem-to-mvp-brief',
      title: 'Workflow: Convert a clinical pain point into an MVP brief',
      summary: 'A venture workflow for doctors moving from observed clinical friction to a pilot-ready product brief.',
      path: 'entrepreneurship',
      content_type: 'workflow',
      tags: ['workflow', 'mvp', 'doctor-founder'],
      source_urls: ['https://greybrain.ai/academy'],
      content_markdown: `## Goal
Turn an observed workflow problem into a structured early venture document.

## Workflow
- Define user, buyer, and operational pain point separately.
- Estimate current workaround cost in time, money, or risk.
- Describe the smallest product behavior that changes the workflow.
- Define one pilot metric and one failure condition.

## Prompt
\`Act as a healthtech venture coach. Based on this clinical workflow problem, produce an MVP brief with user, buyer, pain point, core workflow, pilot metric, and key risk.\`

## Why this matters
Doctor-founders often jump into solution ideas before clarifying the workflow economics.`
    },
    {
      slug: 'workflow-clinic-note-to-patient-instructions',
      title: 'Workflow: Turn a clinic note into patient instructions',
      summary:
        'A practical clinical workflow for converting technical consultation notes into plain-language follow-up instructions patients can actually use.',
      path: 'productivity',
      content_type: 'workflow',
      tags: ['workflow', 'patient-instructions', 'clinical-productivity'],
      source_urls: ['https://greybrain.ai/academy'],
      content_markdown: `## Goal
Convert a doctor-facing note into a patient-facing communication artifact.

## Workflow
- Separate diagnosis, treatment plan, and follow-up tasks.
- Replace medical shorthand with plain action language.
- Make the medication, warning signs, and next-step timing explicit.
- End with one short review question: what should the patient remember most?

## Prompt
\`Act as a physician communication assistant. Convert this clinic note into patient instructions with: medicines, precautions, tests, and when to return.\`

## Why this matters
AI becomes useful in practice when it reduces communication friction without diluting medical accuracy.`
    },
    {
      slug: 'wiki-what-is-an-embedding',
      title: 'Wiki: What is an embedding?',
      summary:
        'A doctor-friendly explanation of embeddings and why they matter for semantic search, evidence retrieval, and grounded AI systems.',
      path: 'research',
      content_type: 'wiki',
      tags: ['wiki', 'embedding', 'ai-basics'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## Definition
An embedding is a numerical representation of meaning. It turns text into vectors so the system can compare similarity, not just exact words.

## Why it matters
In research and learning systems, embeddings help retrieve the most relevant papers, modules, or notes for a question.

## Clinical analogy
Think of it as grouping cases by meaning rather than by exact wording in the chart.

## Rule of thumb
If you want retrieval, clustering, or semantic search, embeddings are usually part of the pipeline.`
    },
    {
      slug: 'model-watch-long-context-research-models',
      title: 'Model Watch: How to judge a long-context research model',
      summary:
        'A framework for deciding whether a long-context model is genuinely useful for literature review and manuscript support, not just impressive on paper.',
      path: 'research',
      content_type: 'model_watch',
      tags: ['model-watch', 'long-context', 'research-ai'],
      source_urls: ['https://huggingface.co/models'],
      content_markdown: `## Start with the workload
The key question is not how many tokens the model accepts. It is whether the model can stay coherent across a literature review task.

## Questions to ask
- Does it retrieve the right study sections without drifting?
- Can it maintain citation fidelity across a long document?
- Does performance collapse when prompts become complex?

## Research warning
Long context is useful only if it preserves structure, relevance, and evidence boundaries.

## GreyBrain use
Use model watch notes to decide what belongs in a manuscript workflow and what remains a demo.`
    },
    {
      slug: 'wiki-what-is-a-pilot-metric',
      title: 'Wiki: What is a pilot metric?',
      summary:
        'A short explainer for doctor-founders on choosing the one outcome that tells you whether an MVP is improving the target workflow.',
      path: 'entrepreneurship',
      content_type: 'wiki',
      tags: ['wiki', 'pilot-metrics', 'doctor-founder'],
      source_urls: ['https://greybrain.ai/academy'],
      content_markdown: `## Definition
A pilot metric is the one measurable outcome you use to judge whether an early implementation is working.

## Why it matters
Healthcare pilots fail when teams measure too many things and learn nothing decisively.

## Good pilot metrics
Good metrics are close to the workflow you are changing: time saved, turnaround time, completion rate, adoption, escalation rate.

## Rule
Pick one leading metric, one safety metric, and one stop condition before the pilot starts.`
    },
    {
      slug: 'workflow-guideline-to-teaching-slides',
      title: 'Workflow: Turn a guideline into teaching slides',
      summary:
        'A repeatable academic workflow for converting a clinical guideline into a concise teaching deck without losing the actual recommendation logic.',
      path: 'research',
      content_type: 'workflow',
      tags: ['workflow', 'guidelines', 'teaching'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## Goal
Convert a dense guideline into a teaching-ready structure for rounds, lectures, or departmental updates.

## Workflow
- Extract the clinical question and intended audience.
- Pull only the recommendations that change action.
- Separate strong recommendations from weak or context-dependent guidance.
- End with one decision pathway slide.

## Prompt
\`Act as an academic clinician educator. Turn this guideline into a 7-slide teaching outline with recommendations, rationale, and one implementation caution.\`

## Why this matters
Doctors often read guidelines but still lose time turning them into usable teaching material.`
    },
    {
      slug: 'model-watch-agents-for-healthcare-operations',
      title: 'Model Watch: When should doctors trust an agent for operations?',
      summary:
        'A practical lens for evaluating agent-style systems in healthcare operations without confusing autonomy with reliability.',
      path: 'entrepreneurship',
      content_type: 'model_watch',
      tags: ['model-watch', 'agents', 'healthcare-operations'],
      source_urls: ['https://huggingface.co/models'],
      content_markdown: `## The core question
An agent is only useful if it completes bounded operational tasks reliably, not if it merely looks autonomous in a demo.

## Questions to ask
- What state does the agent remember?
- Where can the workflow fail silently?
- Can a human interrupt, inspect, and override decisions?
- Is success measured by task completion or by theatrical output?

## Operational rule
In healthcare, agentic systems need explicit boundaries, escalation paths, and auditability.

## Use in GreyBrain
Founders should evaluate agents as workflow operators, not as magic assistants.`
    },
    {
      slug: 'workflow-discharge-summary-to-family-update',
      title: 'Workflow: Turn a discharge summary into a family update',
      summary:
        'A communication workflow for translating a discharge note into a brief, family-friendly update that preserves medications, precautions, and follow-up steps.',
      path: 'productivity',
      content_type: 'workflow',
      tags: ['workflow', 'discharge', 'family-communication'],
      source_urls: ['https://greybrain.ai/academy'],
      content_markdown: `## Goal
Turn a technically correct discharge summary into a message that a family can understand and act on.

## Workflow
- Pull the diagnosis, discharge plan, medication changes, and follow-up date.
- Convert abbreviations and shorthand into plain language.
- Separate must-do actions from helpful background explanation.
- End with one explicit warning: when should the patient return or call?

## Prompt
\`Act as a physician communication assistant. Convert this discharge summary into a family update with medications, home care steps, red flags, and follow-up timing.\`

## Why this matters
Many avoidable post-discharge errors come from communication failure, not treatment failure.`
    },
    {
      slug: 'wiki-what-is-a-context-window',
      title: 'Wiki: What is a context window?',
      summary:
        'A clinician-friendly explanation of context windows and why large input size does not automatically mean better reasoning or safer answers.',
      path: 'research',
      content_type: 'wiki',
      tags: ['wiki', 'context-window', 'ai-basics'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## Definition
A context window is the amount of input a model can read in one interaction.

## Why it matters
Doctors often assume bigger context means better answers. In practice, long context helps only if the model can still identify the relevant signal inside the material.

## Clinical analogy
Giving a trainee the whole chart is useful only if they can still find the key note, trend, or result that matters.

## Rule
Use long context to reduce retrieval friction, not to avoid thinking about structure.`
    },
    {
      slug: 'model-watch-scribe-and-voice-models-for-clinicians',
      title: 'Model Watch: How should doctors judge scribe and voice models?',
      summary:
        'A practical review lens for voice and scribe models used in consultations, documentation, and patient communication workflows.',
      path: 'productivity',
      content_type: 'model_watch',
      tags: ['model-watch', 'voice-ai', 'documentation'],
      source_urls: ['https://huggingface.co/models'],
      content_markdown: `## Start with risk
Voice and scribe models are useful only when they improve documentation speed without introducing silent charting errors.

## Questions to ask
- Does the transcript preserve medication names and numbers?
- Can the model separate patient statements from clinician assessment?
- Is the output easy to verify before sign-off?

## Productivity rule
The right scribe model reduces after-hours documentation, but only if verification stays fast and reliable.

## GreyBrain use
Treat voice models as workflow accelerators, not autonomous record creators.`
    },
    {
      slug: 'workflow-paper-to-poster-outline',
      title: 'Workflow: Turn a paper into a poster outline',
      summary:
        'A research workflow for extracting the argument, methods, results, and visual hierarchy needed for a scientific poster.',
      path: 'research',
      content_type: 'workflow',
      tags: ['workflow', 'poster', 'academic-writing'],
      source_urls: ['https://greybrain.ai/clinical-ai'],
      content_markdown: `## Goal
Move from manuscript or accepted paper to a poster-ready structure without rewriting the whole study from scratch.

## Workflow
- Extract the one-sentence scientific claim.
- Reduce methods to the minimum reproducibility details.
- Pull only the results that deserve visual emphasis.
- End with one slide-equivalent takeaway for the poster conclusion.

## Prompt
\`Act as an academic research editor. Turn this study into a conference poster outline with title, background, methods, results, figures, and takeaway.\`

## Why this matters
Academic doctors often lose time compressing studies into visual formats after the real research work is already done.`
    },
    {
      slug: 'wiki-what-is-a-design-partner-in-healthcare-ai',
      title: 'Wiki: What is a design partner in healthcare AI?',
      summary:
        'A short explainer for doctor-founders on the difference between an interested clinician, an early user, and a true design partner.',
      path: 'entrepreneurship',
      content_type: 'wiki',
      tags: ['wiki', 'design-partner', 'healthcare-startups'],
      source_urls: ['https://greybrain.ai/academy'],
      content_markdown: `## Definition
A design partner is not just someone who likes the idea. It is a real user or buyer who helps shape the workflow, tests assumptions, and gives repeated feedback.

## Why it matters
Healthcare ventures fail when founders mistake enthusiasm for implementation commitment.

## What qualifies
A true design partner gives access to workflow context, reviews iterations, and helps define what success looks like.

## Rule
If the partner will not help test the workflow, they are an interested contact, not a design partner.`
    },
    {
      slug: 'workflow-clinical-audit-to-startup-hypothesis',
      title: 'Workflow: Turn a clinical audit into a startup hypothesis',
      summary:
        'A founder workflow for using audit findings to identify workflow friction, quantify the problem, and shape an early venture thesis.',
      path: 'entrepreneurship',
      content_type: 'workflow',
      tags: ['workflow', 'audit', 'startup-hypothesis'],
      source_urls: ['https://greybrain.ai/academy'],
      content_markdown: `## Goal
Use real-world audit evidence to formulate a credible early venture hypothesis.

## Workflow
- Define the process failure or delay shown by the audit.
- Identify who experiences the cost and who pays for it.
- Convert the finding into a focused problem statement.
- Propose one intervention the market could plausibly adopt.

## Prompt
\`Act as a healthcare venture strategist. Based on this audit result, generate a startup hypothesis with user, buyer, workflow problem, measurable cost, and initial intervention.\`

## Why this matters
Doctor-founders often begin with ideas; stronger ventures usually begin with observed workflow failure.`
    }
  ];
}
