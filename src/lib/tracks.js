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
    ]
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
    ]
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
    ]
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
