const ACADEMY_ORIGIN = 'https://learn.greybrain.ai';
const CLINICAL_FEED_URL = 'https://medium.com/feed/@ClinicalAI';
const HUGGINGFACE_TRENDING_URL = 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=24&full=true';

const FALLBACK_COURSES = [
  {
    name: 'Generative AI For Doctors - Express',
    slug: 'gen-ai-doctors-express',
    type: 'FermionCourse',
    academyUrl: `${ACADEMY_ORIGIN}/course/gen-ai-doctors-express`
  },
  {
    name: 'Generative AI For Healthcare Professionals',
    slug: 'gen-ai-healthcare',
    type: 'FermionCourse',
    academyUrl: `${ACADEMY_ORIGIN}/course/gen-ai-healthcare`
  },
  {
    name: 'Medical Models and Data Analytics with AI',
    slug: 'medical-models-data-analytics',
    type: 'FermionCourse',
    academyUrl: `${ACADEMY_ORIGIN}/course/medical-models-data-analytics`
  },
  {
    name: 'Super Agents: How to Hire AI to Work For You',
    slug: 'super-agents',
    type: 'FermionCourse',
    academyUrl: `${ACADEMY_ORIGIN}/course/super-agents`
  },
  {
    name: 'Running Your Business with AI',
    slug: 'ai-for-business',
    type: 'FermionCourse',
    academyUrl: `${ACADEMY_ORIGIN}/course/ai-for-business`
  },
  {
    name: 'Using AI for Academic Research and Paper Writing',
    slug: 'ai-for-research-papers',
    type: 'FermionCourse',
    academyUrl: `${ACADEMY_ORIGIN}/course/ai-for-research-papers`
  }
];

const FALLBACK_BLOGS = [
  {
    title: 'Gemma 3 and the Rise of Surgical Agents',
    link: 'https://medium.com/@ClinicalAI',
    date: '2026-02-25',
    summary: 'Clinical multimodal reasoning and edge-ready surgical agent workflows for healthcare teams.',
    categories: ['ai', 'healthcare']
  },
  {
    title: 'From Long-Horizon Planning to Predictive Triaging',
    link: 'https://medium.com/@ClinicalAI',
    date: '2026-02-24',
    summary: 'Agentic systems and predictive triage frameworks reshaping applied medicine.',
    categories: ['ai', 'clinical-ai']
  },
  {
    title: 'When Vision Models Meet Clinical Trials',
    link: 'https://medium.com/@ClinicalAI',
    date: '2026-02-23',
    summary: 'How multimodal reasoning and trial intelligence are converging in clinical practice.',
    categories: ['research', 'healthcare']
  }
];

const FALLBACK_HF_MODELS = [
  {
    id: 'google/gemma-3-27b-it',
    pipeline_tag: 'text-generation',
    likes: 0,
    downloads: 0,
    createdAt: '2026-02-15T00:00:00.000Z',
    cardData: { license: 'gemma' }
  },
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    pipeline_tag: 'text-generation',
    likes: 0,
    downloads: 0,
    createdAt: '2026-01-28T00:00:00.000Z',
    cardData: { license: 'llama3.3' }
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    pipeline_tag: 'text-generation',
    likes: 0,
    downloads: 0,
    createdAt: '2026-01-22T00:00:00.000Z',
    cardData: { license: 'apache-2.0' }
  },
  {
    id: 'microsoft/phi-4',
    pipeline_tag: 'text-generation',
    likes: 0,
    downloads: 0,
    createdAt: '2026-02-03T00:00:00.000Z',
    cardData: { license: 'mit' }
  },
  {
    id: 'BAAI/bge-base-en-v1.5',
    pipeline_tag: 'feature-extraction',
    likes: 0,
    downloads: 0,
    createdAt: '2025-11-10T00:00:00.000Z',
    cardData: { license: 'mit' }
  }
];

const STARTER_COURSES = [
  {
    name: 'AI Refresher For Doctors',
    slug: 'ai-refresher-for-doctors',
    type: 'GreyBrainStarterCourse',
    thumbnailUrl: '',
    academyUrl: '/#enroll',
    ctaUrl: '/#enroll',
    ctaLabel: 'Register To Unlock',
    ctaTarget: '_self',
    accessModel: 'registration',
    deliveryLabel: 'Beginner refresher',
    badgeLabel: 'Open after registration',
    shortDescription:
      'A 20-30 minute interactive orientation for doctors who want to understand how AI moves from prompt to real clinical, academic, and venture outputs.',
    longDescription:
      'This refresher is a low-friction AI sensitization layer for clinicians, faculty, and medical colleges that want clarity before committing to a full GreyBrain pathway. It explains prompt, context, model behavior, review, and output in plain doctor language, then shows how the same AI foundations drive practical workflows in clinical work, research, and venture building.',
    goals: [
      'Understand what sits between prompt and answer without needing a coding or deep learning background.',
      'See how context, review, and workflow design change the quality of AI outputs in medicine.',
      'Compare AI outputs for clinical practice, academic publication, and venture building in one guided orientation.',
      'Leave with a clear recommendation for the GreyBrain path that fits the learner next.'
    ],
    lessons: [
      'Chapter 1: Prompt to answer',
      'Chapter 2: Why context matters',
      'Chapter 3: How models work without the jargon',
      'Chapter 4: Why review still matters',
      'Chapter 5: What good outputs look like',
      'Chapter 6: Choose your GreyBrain path'
    ],
    faqs: [
      {
        question: 'Who is this refresher for?',
        answer:
          'Doctors, faculty, residents, and medical college groups that want a practical AI orientation before joining a deeper GreyBrain cohort.'
      },
      {
        question: 'How long is it?',
        answer:
          'The refresher is designed as a short 20-30 minute guided orientation, not a long certificate course.'
      },
      {
        question: 'When does it unlock?',
        answer: 'The refresher unlocks after registration and acts as a bridge into the full cohort pathways.'
      },
      {
        question: 'What happens after the refresher?',
        answer:
          'Learners receive a clear next-step recommendation toward Path 1 for clinical productivity, Path 2 for research acceleration, or Path 3 for entrepreneurship and venture building.'
      },
      {
        question: 'Can medical colleges use this before a webinar or workshop?',
        answer:
          'Yes. The refresher works well as a pre-webinar primer or post-session consolidation layer for colleges and departments that want a shared AI vocabulary before deeper training.'
      }
    ],
    instructors: ['GreyBrain Faculty Team'],
    lessonCount: 6,
    rating: 0,
    isSyllabusVisible: true,
    trackHint: 'productivity'
  }
];

const COURSE_CONTENT_OVERRIDES = {
  'gen-ai-doctors-express': {
    shortDescription:
      'A focused starter track for doctors who want immediate gains in prompting, clinical documentation, patient communication, and safe workflow delegation.',
    longDescription:
      'Designed for busy clinicians who need immediate utility rather than abstract theory, this course shows how AI fits inside OPD, ward, discharge, and follow-up workflows. The emphasis is on practical prompting, documentation support, patient communication, and review discipline so doctors can reduce administrative load without weakening clinical judgment.',
    deliveryLabel: 'Fast-start clinical workflow sprint',
    badgeLabel: 'Best first full cohort for clinicians',
    goals: [
      'Use AI for notes, discharge summaries, and patient-facing explanations without adding technical overhead.',
      'Build repeatable prompting patterns for OPD, ward, follow-up, and communication-heavy workflows.',
      'Apply basic safety, review, and escalation rules before using AI outputs in daily practice.',
      'Leave with one real specialty-specific workflow that can be used immediately after the course.'
    ],
    lessons: [
      'Module 1: Prompting for clinic, ward, and OPD workflows',
      'Module 2: Turning notes into patient-ready explanations',
      'Module 3: Documentation acceleration without losing context',
      'Module 4: Review rules, hallucination traps, and safe adoption',
      'Module 5: Building your first specialty workflow playbook',
      'Module 6: Using the AI tutor for ongoing case-based practice'
    ],
    faqs: [
      {
        question: 'Who should start with this course?',
        answer:
          'Doctors who are AI-curious but want immediate day-to-day leverage in documentation, communication, and workflow reduction should start here.'
      },
      {
        question: 'Will this teach coding or deep technical concepts?',
        answer:
          'No. This track is designed for clinicians who want applied AI capability, not engineering depth. It explains enough of the logic to use AI well and safely.'
      },
      {
        question: 'What changes after completion?',
        answer:
          'You should be able to structure better prompts, generate clearer patient-facing explanations, reduce repetitive documentation work, and review outputs with more confidence.'
      },
      {
        question: 'Is this only for individual doctors?',
        answer:
          'No. It also works for departments, small clinical teams, and institutions that want a first operational layer before deeper research or entrepreneurship pathways.'
      },
      {
        question: 'How does the AI tutor help inside this course?',
        answer:
          'The tutor helps you adapt course patterns to your own specialty, cases, communication style, and workflow constraints rather than forcing generic examples.'
      }
    ],
    instructors: ['GreyBrain Clinical AI Faculty'],
    trackHint: 'productivity'
  },
  'gen-ai-healthcare': {
    shortDescription:
      'A broader implementation track for clinicians and healthcare teams who want to redesign real workflows with AI, not just understand the terminology.',
    longDescription:
      'This course takes clinicians and healthcare teams from general AI awareness to structured adoption planning. It covers workflow selection, change management, communication redesign, and implementation priorities so learners can decide where AI fits operationally across their own service lines.',
    deliveryLabel: 'Clinical implementation cohort',
    badgeLabel: 'For clinicians and care teams',
    goals: [
      'Translate core AI concepts into communication, triage, documentation, and operational workflows.',
      'Identify where AI supports teams safely without replacing clinical judgment or accountability.',
      'Map one real healthcare workflow for implementation and adoption planning.',
      'Understand where to start, where not to start, and how to phase AI into clinical systems.'
    ],
    lessons: [
      'Module 1: AI foundations for healthcare teams',
      'Module 2: Where AI helps in communication, operations, and care delivery',
      'Module 3: Workflow mapping, prioritization, and pilot selection',
      'Module 4: Human review, compliance, and governance basics',
      'Module 5: Implementation planning for one real workflow',
      'Module 6: Measuring impact and deciding next-phase scale-up'
    ],
    faqs: [
      {
        question: 'How is this different from the Express course?',
        answer:
          'Express is about immediate personal workflow gains for doctors. This course is broader and better for clinicians or teams thinking about implementation across a service or organization.'
      },
      {
        question: 'Is this suitable for hospitals or departments?',
        answer:
          'Yes. It is useful for departments, institutions, and operational teams that need a structured way to identify, prioritize, and pilot AI-enabled workflows.'
      },
      {
        question: 'What kind of output should a learner expect?',
        answer:
          'Learners should leave with a clearer implementation map for one workflow, including where AI adds value, where human review stays mandatory, and what a sensible first pilot looks like.'
      },
      {
        question: 'Does this include AI tutor support?',
        answer:
          'Yes. The tutor helps translate the framework into your own care pathway, department process, or communication workflow.'
      }
    ],
    instructors: ['GreyBrain Implementation Faculty'],
    trackHint: 'productivity'
  },
  'medical-models-data-analytics': {
    shortDescription:
      'A clinician-oriented analytics course for doctors who want to understand models, data signals, and how AI outputs should be interpreted before real-world use.',
    longDescription:
      'This course helps doctors build better judgment around medical models, data interpretation, and analytics-driven decisions. Instead of teaching heavy math, it explains what clinicians actually need to understand before trusting predictive outputs, dashboards, or model claims in research, operations, or clinical settings.',
    deliveryLabel: 'Analytics and model judgment lab',
    badgeLabel: 'For clinically literate AI evaluation',
    goals: [
      'Interpret common model, data, and evaluation concepts that appear in healthcare AI tools and dashboards.',
      'Understand what sensitivity, specificity, calibration, drift, and validation mean in practical terms.',
      'Decide when an AI or analytics output is useful, when it is weak, and when it needs deeper scrutiny.',
      'Build confidence in discussing model quality with product, research, or operations teams.'
    ],
    lessons: [
      'Module 1: A clinician’s translation guide to model terminology',
      'Module 2: Reading predictive outputs without statistical overload',
      'Module 3: Performance metrics that matter in practice',
      'Module 4: Bias, drift, and why models fail outside controlled settings',
      'Module 5: Analytics dashboards, alerts, and operational decisions',
      'Module 6: Evaluating whether a model is implementation-ready'
    ],
    faqs: [
      {
        question: 'Do I need a statistics or coding background?',
        answer:
          'No. The course is designed for clinicians who want practical model literacy, not advanced data science training.'
      },
      {
        question: 'Why is this relevant for doctors?',
        answer:
          'Doctors increasingly face model outputs, predictive dashboards, and AI product claims. This course helps you judge them more rigorously instead of accepting them at face value.'
      },
      {
        question: 'Is this a research course or a clinical course?',
        answer:
          'It supports both. The focus is on model judgment, which matters whether you are reading a paper, evaluating a product, or making an operational decision.'
      }
    ],
    instructors: ['GreyBrain Analytics Faculty'],
    trackHint: 'productivity'
  },
  'super-agents': {
    shortDescription:
      'Build AI-assisted agent workflows that remove repetitive work and create leverage for clinicians and operators.',
    longDescription:
      'This course focuses on designing agent-based workflows for repetitive tasks, operational coordination, and implementation support in healthcare and adjacent business settings.',
    goals: [
      'Map repetitive work that can be delegated to AI-assisted agent workflows.',
      'Design practical agent systems with clear human oversight.',
      'Use AI labor strategically without losing process control.'
    ]
  },
  'ai-for-business': {
    shortDescription:
      'Use AI to improve healthcare business systems, service design, and operational decision-making.',
    longDescription:
      'A venture-focused course for clinicians and operators who want to apply AI to growth systems, service design, operational leverage, and healthcare entrepreneurship.',
    goals: [
      'Use AI to improve business planning and operational leverage.',
      'Design growth and service workflows for AI-enabled healthcare offerings.',
      'Convert domain insight into structured business execution.'
    ]
  },
  'ai-for-research-papers': {
    shortDescription:
      'A practical writing and research workflow course for doctors who want faster literature review, stronger synthesis, and better manuscripts.',
    longDescription:
      'This course teaches research augmentation for clinicians, covering literature review, evidence synthesis, manuscript structuring, and publication workflows with AI support.',
    goals: [
      'Accelerate review and synthesis of clinical literature with AI.',
      'Structure research questions, evidence maps, and manuscript outlines more efficiently.',
      'Reduce repetitive drafting time while improving academic workflow quality.'
    ]
  }
};

let academyHomeCache = null;
const courseDetailCache = new Map();

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(value, limit = 180) {
  const text = cleanText(value);
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit);
  const boundary = Math.max(sliced.lastIndexOf(' '), sliced.lastIndexOf(','), sliced.lastIndexOf(';'));
  const trimmed = boundary > 60 ? sliced.slice(0, boundary) : sliced;
  return `${trimmed.trim()}...`;
}

function getSentences(value) {
  const text = cleanText(value);
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]?/g) || [];
  return matches.map((item) => item.trim()).filter(Boolean);
}

function editorializeTitle(value) {
  const normalized = cleanText(value)
    .replace(/^greybrain\.?ai daily\s*[—:-]\s*/i, '')
    .replace(/^stay ahead in medicine\s*[—:-]\s*/i, '')
    .replace(/^card\s*\d+\s*[:.-]\s*/i, '')
    .replace(/\s*\|\s*greybrain.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return truncateAtWord(normalized, 92);
}

function editorializeSummary(value, fallback = '', limit = 190) {
  const normalized = cleanText(value)
    .replace(/^\s*the doctors who master ai today will define the future of medicine tomorrow\.?\s*/i, '')
    .replace(/^\s*from ai curious to ai confident\.?\s*/i, '')
    .replace(/\[\[[\s\S]*?\]\]/g, '')
    .replace(/would you like me to[\s\S]*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = getSentences(normalized);
  if (sentences.length === 0) {
    return truncateAtWord(fallback || normalized, limit);
  }

  let result = '';
  for (const sentence of sentences) {
    const candidate = result ? `${result} ${sentence}` : sentence;
    if (candidate.length > limit && result) break;
    result = candidate;
    if (result.length >= limit * 0.72) break;
  }

  return truncateAtWord(result || fallback || normalized, limit);
}

function firstParagraph(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/<p>([\s\S]*?)<\/p>/i);
  if (!match) return cleanText(value).slice(0, 220);
  return cleanText(match[1]).slice(0, 220);
}

function parseIsoDate(value) {
  if (typeof value !== 'string') return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toK(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 'n/a';
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return `${Math.round(number)}`;
}

function explainTaskForClinicians(task) {
  const normalized = cleanText(String(task || '')).toLowerCase();
  if (normalized.includes('feature-extraction') || normalized.includes('embedding')) {
    return 'Useful for retrieval workflows: clustering papers, semantic search, and evidence mapping.';
  }
  if (normalized.includes('text-generation') || normalized.includes('conversational')) {
    return 'Useful for drafting summaries, reviewer responses, and protocol-ready writing workflows.';
  }
  if (normalized.includes('summarization')) {
    return 'Useful for condensing long papers into concise abstracts and teaching notes.';
  }
  if (normalized.includes('token-classification')) {
    return 'Useful for extracting entities, outcomes, and protocol fields from clinical text.';
  }
  if (normalized.includes('image') || normalized.includes('vision')) {
    return 'Useful for multimodal pipelines where image context must be linked with clinical notes.';
  }
  return 'Useful for healthcare AI experimentation where model behavior must be tested before workflow adoption.';
}

function formatPipelineLabel(task) {
  const normalized = cleanText(String(task || '')).toLowerCase();
  if (!normalized) return 'general AI work';
  if (normalized.includes('feature-extraction') || normalized.includes('embedding')) return 'retrieval and evidence search';
  if (normalized.includes('text-generation') || normalized.includes('conversational')) return 'drafting and reasoning';
  if (normalized.includes('summarization')) return 'paper summarization';
  if (normalized.includes('token-classification')) return 'clinical text extraction';
  if (normalized.includes('image') || normalized.includes('vision')) return 'multimodal clinical interpretation';
  return normalized.replace(/-/g, ' ');
}

function normalizeModelSpotlight(model, index = 0) {
  const modelId = cleanText(model?.id || model?.modelId || '').slice(0, 160);
  if (!modelId) return null;
  const pipelineTag = cleanText(model?.pipeline_tag || model?.pipelineTag || 'general');
  const likes = Number(model?.likes || 0);
  const downloads = Number(model?.downloads || 0);
  const createdAt = parseIsoDate(model?.createdAt || model?.lastModified || model?.publishedAt || '');
  const license = cleanText(model?.cardData?.license || model?.license || '');
  const shortModelName = modelId.includes('/') ? modelId.split('/').pop() : modelId;
  const summary = editorializeSummary(
    `Trending on Hugging Face for ${formatPipelineLabel(pipelineTag)}. ${explainTaskForClinicians(pipelineTag)} Signal strength: ${toK(downloads)} downloads and ${toK(
      likes
    )} likes.${license ? ` License: ${license}.` : ''}`,
    'Trending healthcare-relevant model worth testing before workflow adoption.',
    200
  );
  const text = `${modelId} ${pipelineTag}`.toLowerCase();
  const pathHint = /(research|paper|embedding|summarization|token|classification)/.test(text)
    ? 'research'
    : /(startup|agent|api|product|deploy)/.test(text)
      ? 'entrepreneurship'
      : 'productivity';

  return {
    title: editorializeTitle(`Model Watch: ${shortModelName}`),
    link: `https://huggingface.co/${modelId}`,
    date: createdAt || '',
    summary,
    categories: ['model-spotlight', 'hugging-face', pipelineTag || 'general'].filter(Boolean),
    source: 'huggingface',
    sourceLabel: 'Hugging Face',
    pathHint,
    sortScore: likes + downloads + (1000 - index)
  };
}

async function fetchText(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GreyBrainCrawler/1.0)'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function normalizeProduct(product) {
  if (!product?.slug) return null;
  const isCourse = String(product.type || '').toLowerCase().includes('course');
  return {
    name: product.name || '',
    slug: product.slug,
    type: product.type || '',
    thumbnailUrl: product.thumbnailUrl || '',
    academyUrl: `${ACADEMY_ORIGIN}/${isCourse ? 'course' : 'product'}/${product.slug}`
  };
}

function normalizeArrayText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(String(item))).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => cleanText(String(item))).filter(Boolean);
        }
      } catch {
        // Ignore parse errors and continue.
      }
    }

    return trimmed
      .split('\n')
      .map((line) => cleanText(line.replace(/^[-*]\s*/, '')))
      .filter(Boolean);
  }

  return [];
}

function normalizeFaqs(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { question: cleanText(item), answer: '' };
      }

      return {
        question: cleanText(item?.question || item?.title || ''),
        answer: cleanText(item?.answer || item?.description || '')
      };
    })
    .filter((faq) => faq.question);
}

function normalizeCourseDetails(slug, pageProps) {
  const courseData = pageProps?.courseData || {};
  const courseItemsData = pageProps?.courseItemsData || {};
  const lessonsRaw = Array.isArray(courseItemsData.courseItems) ? courseItemsData.courseItems : [];
  const instructors = Array.isArray(courseData.instructors)
    ? courseData.instructors.map((item) => cleanText(item?.name || '')).filter(Boolean)
    : [];

  const lessons = lessonsRaw
    .map((item) => cleanText(item?.name || item?.title || item?.moduleName || ''))
    .filter(Boolean);

  const shortDescription = cleanText(courseData.shortDescription || '');
  const longDescription = cleanText(courseData.longDescriptionInMarkdown || '');
  const goals = normalizeArrayText(courseData.goalsInMarkdown);

  return {
    slug,
    name: cleanText(courseData.name || slug),
    academyUrl: `${ACADEMY_ORIGIN}/course/${slug}`,
    thumbnailUrl: courseData.thumbnailUrl || '',
    shortDescription: shortDescription || 'Practical AI training designed for healthcare professionals.',
    longDescription: longDescription || shortDescription || 'Learn with guided modules, practical workflows, and implementation focus.',
    goals,
    faqs: normalizeFaqs(courseData.faqs),
    instructors,
    lessonCount: lessons.length,
    lessons,
    rating: Number(courseData.courseAverageRatingOutOf10 || 0),
    isSyllabusVisible: Boolean(courseData.isSyllabusVisibleOnCourseLandingPage)
  };
}

function applyCourseContentOverrides(course) {
  if (!course?.slug) return course;
  const override = COURSE_CONTENT_OVERRIDES[course.slug];
  const baseCourse = normalizeCourseCta(course);
  if (!override) return baseCourse;

  const mergedLessons = Array.isArray(override.lessons) && override.lessons.length > 0 ? override.lessons : baseCourse.lessons;
  const mergedFaqs = Array.isArray(override.faqs) && override.faqs.length > 0 ? override.faqs : baseCourse.faqs;
  const mergedInstructors =
    Array.isArray(override.instructors) && override.instructors.length > 0 ? override.instructors : baseCourse.instructors;

  return {
    ...baseCourse,
    shortDescription: override.shortDescription || baseCourse.shortDescription,
    longDescription: override.longDescription || baseCourse.longDescription,
    goals: Array.isArray(override.goals) && override.goals.length > 0 ? override.goals : baseCourse.goals,
    lessons: mergedLessons,
    lessonCount: mergedLessons.length || baseCourse.lessonCount || 0,
    faqs: mergedFaqs,
    instructors: mergedInstructors,
    deliveryLabel: override.deliveryLabel || baseCourse.deliveryLabel || '',
    badgeLabel: override.badgeLabel || baseCourse.badgeLabel || '',
    trackHint: override.trackHint || baseCourse.trackHint || ''
  };
}

function normalizeCourseCta(course) {
  const accessModel = cleanText(course?.accessModel || '') || 'academy';
  const ctaUrl = cleanText(course?.ctaUrl || course?.academyUrl || '');
  return {
    ...course,
    accessModel,
    ctaUrl,
    ctaLabel:
      cleanText(course?.ctaLabel || '') ||
      (accessModel === 'registration' ? 'Register To Unlock' : 'Enroll'),
    ctaTarget:
      cleanText(course?.ctaTarget || '') ||
      (ctaUrl.startsWith('http') ? '_blank' : '_self'),
    badgeLabel:
      cleanText(course?.badgeLabel || '') ||
      (accessModel === 'registration' ? 'Open after registration' : '')
  };
}

function getStarterCourse(slug) {
  return STARTER_COURSES.find((course) => course.slug === slug) || null;
}

export async function getAcademyHomeData() {
  if (academyHomeCache) {
    return academyHomeCache;
  }

  try {
    const html = await fetchText(`${ACADEMY_ORIGIN}/`);
    const nextData = extractNextData(html);
    const pageProps = nextData?.props?.pageProps || {};
    const products = Array.isArray(pageProps.products) ? pageProps.products : [];

    academyHomeCache = {
      products: products.map(normalizeProduct).filter(Boolean),
      features: pageProps?.sitewideContext?.fermionSchoolConfig?.enabledFeatures || []
    };

    return academyHomeCache;
  } catch {
    academyHomeCache = {
      products: [...FALLBACK_COURSES],
      features: []
    };
    return academyHomeCache;
  }
}

export async function getCourseSummaries() {
  const data = await getAcademyHomeData();
  const summaries = data.products.filter((product) => String(product.type).toLowerCase().includes('course'));
  const normalized = (summaries.length > 0 ? summaries : [...FALLBACK_COURSES]).map(normalizeCourseCta);
  return [...STARTER_COURSES.map(normalizeCourseCta), ...normalized.filter((course) => !STARTER_COURSES.some((starter) => starter.slug === course.slug))];
}

export async function getCourseDetails(slug) {
  if (!slug) return null;
  if (courseDetailCache.has(slug)) {
    return courseDetailCache.get(slug);
  }

  const starterCourse = getStarterCourse(slug);
  if (starterCourse) {
    const normalizedStarter = applyCourseContentOverrides(starterCourse);
    courseDetailCache.set(slug, normalizedStarter);
    return normalizedStarter;
  }

  try {
    const html = await fetchText(`${ACADEMY_ORIGIN}/course/${slug}`);
    const nextData = extractNextData(html);
    const pageProps = nextData?.props?.pageProps || {};
    const details = applyCourseContentOverrides(normalizeCourseDetails(slug, pageProps));
    courseDetailCache.set(slug, details);
    return details;
  } catch {
    const summary = (await getCourseSummaries()).find((item) => item.slug === slug);
    const fallback = {
      slug,
      name: summary?.name || slug,
      academyUrl: summary?.academyUrl || `${ACADEMY_ORIGIN}/course/${slug}`,
      ctaUrl: summary?.ctaUrl || summary?.academyUrl || `${ACADEMY_ORIGIN}/course/${slug}`,
      ctaLabel: summary?.ctaLabel || 'Enroll',
      ctaTarget: summary?.ctaTarget || '_blank',
      accessModel: summary?.accessModel || 'academy',
      badgeLabel: summary?.badgeLabel || '',
      thumbnailUrl: summary?.thumbnailUrl || '',
      shortDescription: 'Practical AI training track for healthcare professionals.',
      longDescription: 'This course helps healthcare professionals move from AI awareness to AI implementation.',
      goals: [
        'Understand the applied AI workflow for healthcare use-cases.',
        'Implement practical no-code AI systems in daily practice.',
        'Build confidence for deployment-focused AI adoption.'
      ],
      faqs: [],
      instructors: [],
      lessonCount: 0,
      lessons: [],
      rating: 0,
      isSyllabusVisible: false
    };
    const normalizedFallback = applyCourseContentOverrides(fallback);
    courseDetailCache.set(slug, normalizedFallback);
    return normalizedFallback;
  }
}

export async function getCourseCatalog() {
  const summaries = await getCourseSummaries();
  const detailResults = await Promise.all(summaries.map((summary) => getCourseDetails(summary.slug)));

  return detailResults
    .filter(Boolean)
    .map((detail) => {
      const summary = summaries.find((item) => item.slug === detail.slug);
      return {
        ...applyCourseContentOverrides(detail),
        thumbnailUrl: detail.thumbnailUrl || summary?.thumbnailUrl || '',
        academyUrl: detail.academyUrl || summary?.academyUrl || `${ACADEMY_ORIGIN}/course/${detail.slug}`,
        ctaUrl: detail.ctaUrl || summary?.ctaUrl || detail.academyUrl || summary?.academyUrl || `${ACADEMY_ORIGIN}/course/${detail.slug}`,
        ctaLabel: detail.ctaLabel || summary?.ctaLabel || 'Enroll',
        ctaTarget: detail.ctaTarget || summary?.ctaTarget || '_blank',
        accessModel: detail.accessModel || summary?.accessModel || 'academy',
        badgeLabel: detail.badgeLabel || summary?.badgeLabel || ''
      };
    });
}

export async function getClinicalFeedPosts(limit = 6) {
  try {
    const xml = await fetchText(CLINICAL_FEED_URL);
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
    const posts = items.map((item) => {
      const title = cleanText((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const link = cleanText((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
      const pubDateRaw = cleanText((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
      const content = (item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || [])[1] || '';
      const categories = [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)]
        .map((entry) => cleanText(entry[1]))
        .filter(Boolean);

      return {
        title: editorializeTitle(title),
        link: link || 'https://greybrain.ai/clinical-ai',
        date: parseIsoDate(pubDateRaw) || '',
        summary: editorializeSummary(firstParagraph(content), 'Clinical AI update from GreyBrain.'),
        categories
      };
    });

    const filtered = posts.filter((post) => post.title && post.link);
    return filtered.slice(0, Math.max(1, limit));
  } catch {
    return FALLBACK_BLOGS.slice(0, Math.max(1, limit));
  }
}

export async function getHuggingFaceModelSpotlights(limit = 6) {
  const maxItems = Math.max(1, Math.min(12, Number(limit || 6)));
  const fallback = FALLBACK_HF_MODELS.map((item, index) => normalizeModelSpotlight(item, index)).filter(Boolean);

  try {
    const raw = await fetchText(HUGGINGFACE_TRENDING_URL, 12000);
    const parsed = JSON.parse(raw);
    const models = Array.isArray(parsed) ? parsed : [];
    const normalized = models
      .map((model, index) => normalizeModelSpotlight(model, index))
      .filter(Boolean)
      .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0))
      .slice(0, maxItems)
      .map(({ sortScore, ...rest }) => rest);

    if (normalized.length > 0) return normalized;
    return fallback.slice(0, maxItems).map(({ sortScore, ...rest }) => rest);
  } catch {
    return fallback.slice(0, maxItems).map(({ sortScore, ...rest }) => rest);
  }
}

export function formatDisplayDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed);
}
