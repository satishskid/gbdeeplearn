export const TRACKS = [
  {
    slug: 'clinical-ai-practitioner',
    title: 'Clinical AI Practitioner',
    tagline: 'Use AI in real healthcare workflows safely and effectively.',
    duration: '8-10 weeks',
    idealFor: 'Doctors, clinicians, and care teams',
    courseSlugs: ['gen-ai-doctors-express', 'gen-ai-healthcare', 'medical-models-data-analytics'],
    outcomes: [
      'Implement AI-supported documentation and communication flows.',
      'Use AI-assisted clinical reasoning with clear guardrails.',
      'Build confidence in medical data and model interpretation.'
    ],
    curriculumBlueprint: [
      { block: 'Weeks 1-2', focus: 'AI foundations for clinicians, safety boundaries, and prompt hygiene.' },
      { block: 'Weeks 3-5', focus: 'Clinical documentation, communication, and decision-support workflows.' },
      { block: 'Weeks 6-8', focus: 'Department-level implementation, governance checks, and SOP handoff.' }
    ],
    deliverables: ['Prompt playbook for one specialty workflow', 'Team SOP for AI-supported communication', 'Implementation checklist with risk controls'],
    assessmentGates: ['Module assignments (rubric scored)', 'Workflow simulation review', 'Final deployment readiness review'],
    completionCriteria: ['All core assignments passed', 'Minimum rubric threshold met', 'Final implementation checklist submitted']
  },
  {
    slug: 'ai-research-accelerator',
    title: 'AI Research Accelerator',
    tagline: 'Speed up literature review, writing, and research execution.',
    duration: '6-8 weeks',
    idealFor: 'Academic doctors, researchers, and PG students',
    courseSlugs: ['ai-for-research-papers', 'gen-ai-healthcare'],
    outcomes: [
      'Design faster research synthesis workflows with AI.',
      'Draft publication-ready structures and evidence maps.',
      'Reduce manual time spent on repetitive research steps.'
    ],
    curriculumBlueprint: [
      { block: 'Weeks 1-2', focus: 'Hypothesis framing, protocol logic, inclusion/exclusion discipline, and confounder mapping.' },
      { block: 'Weeks 3-4', focus: 'Literature synthesis and evidence extraction with reproducible AI workflows.' },
      { block: 'Weeks 5-6', focus: 'Study design translation into data logic, baselines, and experiment planning.' },
      { block: 'Weeks 7-8', focus: 'Manuscript structuring, reviewer response preparation, and publication readiness.' }
    ],
    deliverables: [
      'Research question matrix with endpoint definitions',
      'Evidence map + citation-backed synthesis output',
      'Study design sheet with variable and bias controls',
      'Manuscript draft outline with reviewer risk notes'
    ],
    assessmentGates: ['Methodology checkpoint rubric', 'Evidence quality checkpoint', 'Final manuscript readiness review'],
    completionCriteria: ['All research modules submitted', 'Rubric score >= 70 for core checkpoints', 'Final capstone accepted by mentor review']
  },
  {
    slug: 'doctor-ai-entrepreneurship',
    title: 'Doctor AI Entrepreneurship',
    tagline: 'Launch AI-enabled services, products, and practice growth systems.',
    duration: '8-12 weeks',
    idealFor: 'Doctor founders and healthcare operators',
    courseSlugs: ['ai-for-business', 'super-agents', 'gen-ai-doctors-express'],
    outcomes: [
      'Build AI-assisted business and growth playbooks.',
      'Deploy super-agent workflows for productivity leverage.',
      'Move from AI learner to AI-enabled healthcare entrepreneur.'
    ],
    curriculumBlueprint: [
      { block: 'Weeks 1-2', focus: 'Problem discovery, demand validation, and stakeholder interview discipline.' },
      { block: 'Weeks 3-5', focus: 'No-code MVP build, workflow boundaries, and clinical safety guardrails.' },
      { block: 'Weeks 6-8', focus: 'Pilot design, adoption metrics, compliance packaging, and pricing logic.' },
      { block: 'Weeks 9-10', focus: 'Capstone narrative, data room readiness, and venture committee review.' }
    ],
    deliverables: [
      'Validated problem brief + market signal memo',
      'No-code MVP demo with workflow boundaries',
      'Pilot KPI sheet and rollout plan',
      'Investment memo and capstone pitch deck'
    ],
    assessmentGates: ['Problem-solution fit review', 'MVP and pilot gate review', 'Capstone investment-readiness review'],
    completionCriteria: ['Core venture modules passed', 'Capstone artifact + pitch deck submitted', 'Review status marked accepted or passed']
  }
];

export function getTrackBySlug(slug) {
  return TRACKS.find((track) => track.slug === slug) || null;
}

export function hydrateTrack(track, courses) {
  if (!track) return null;
  const bySlug = new Map((courses || []).map((course) => [course.slug, course]));
  const includedCourses = track.courseSlugs.map((slug) => bySlug.get(slug)).filter(Boolean);

  return {
    ...track,
    includedCourses
  };
}
