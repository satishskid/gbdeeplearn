const ACADEMY_ORIGIN = 'https://learn.greybrain.ai';
const CLINICAL_FEED_URL = 'https://medium.com/feed/@ClinicalAI';

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
  return summaries.length > 0 ? summaries : [...FALLBACK_COURSES];
}

export async function getCourseDetails(slug) {
  if (!slug) return null;
  if (courseDetailCache.has(slug)) {
    return courseDetailCache.get(slug);
  }

  try {
    const html = await fetchText(`${ACADEMY_ORIGIN}/course/${slug}`);
    const nextData = extractNextData(html);
    const pageProps = nextData?.props?.pageProps || {};
    const details = normalizeCourseDetails(slug, pageProps);
    courseDetailCache.set(slug, details);
    return details;
  } catch {
    const summary = (await getCourseSummaries()).find((item) => item.slug === slug);
    const fallback = {
      slug,
      name: summary?.name || slug,
      academyUrl: summary?.academyUrl || `${ACADEMY_ORIGIN}/course/${slug}`,
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
    courseDetailCache.set(slug, fallback);
    return fallback;
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
        ...detail,
        thumbnailUrl: detail.thumbnailUrl || summary?.thumbnailUrl || '',
        academyUrl: detail.academyUrl || summary?.academyUrl || `${ACADEMY_ORIGIN}/course/${detail.slug}`
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
        title,
        link: link || 'https://greybrain.ai/clinical-ai',
        date: parseIsoDate(pubDateRaw) || '',
        summary: firstParagraph(content) || 'Clinical AI update from GreyBrain.',
        categories
      };
    });

    const filtered = posts.filter((post) => post.title && post.link);
    return filtered.slice(0, Math.max(1, limit));
  } catch {
    return FALLBACK_BLOGS.slice(0, Math.max(1, limit));
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
