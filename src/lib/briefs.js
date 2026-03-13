const DEFAULT_CONTENT_API_ORIGIN = 'https://med-greybrain-worker.satish-9f4.workers.dev';
export const BRIEF_PATH_META = {
  productivity: {
    label: 'Practice',
    eyebrow: 'Clinical Productivity',
    accent: 'emerald'
  },
  research: {
    label: 'Publish',
    eyebrow: 'Research Acceleration',
    accent: 'sky'
  },
  entrepreneurship: {
    label: 'Build',
    eyebrow: 'Entrepreneurship',
    accent: 'amber'
  }
};

export const CONTENT_TYPE_META = {
  daily_brief: {
    label: 'Daily Brief',
    description: 'Fast editorial signal for doctors.'
  },
  workflow: {
    label: 'Workflow',
    description: 'Reusable doctor-facing prompt or process.'
  },
  wiki: {
    label: 'Wiki',
    description: 'Evergreen concept explainer.'
  },
  model_watch: {
    label: 'Model Watch',
    description: 'A model worth tracking and testing.'
  }
};

export function getContentApiOrigin() {
  return (import.meta.env.PUBLIC_DEEPLEARN_API_ORIGIN || DEFAULT_CONTENT_API_ORIGIN).replace(/\/+$/, '');
}

export async function fetchPublishedBriefs(limit = 100) {
  const response = await fetch(`${getContentApiOrigin()}/api/content/posts?limit=${Math.min(200, Math.max(1, Number(limit) || 100))}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load published briefs.');
  }
  return Array.isArray(payload?.posts) ? payload.posts : [];
}

export async function fetchLatestByType(contentType) {
  try {
    const response = await fetch(
      `${getContentApiOrigin()}/api/content/posts?limit=1&content_type=${encodeURIComponent(contentType)}`
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const posts = Array.isArray(payload?.posts) ? payload.posts : [];
    return posts[0] || null;
  } catch {
    return null;
  }
}

export async function postLike(postId) {
  try {
    const response = await fetch(`${getContentApiOrigin()}/api/content/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST'
    });
    const payload = await response.json();
    return { ok: response.ok, likes: payload?.community_likes ?? 0 };
  } catch {
    return { ok: false, likes: 0 };
  }
}


export async function fetchPublishedBriefBySlug(slug) {
  const response = await fetch(`${getContentApiOrigin()}/api/content/posts/${encodeURIComponent(slug)}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load published brief.');
  }
  return payload?.post || null;
}

/**
 * Fetches the global homepage configuration from the worker.
 * Returns the parsed config object (e.g., { ticker_text: '...', ... }) or {} on failure.
 * NOTE: This is a PUBLIC read – no auth required at the worker level for this endpoint variant.
 */
export async function fetchHomepageConfig() {
  try {
    const response = await fetch(`${getContentApiOrigin()}/api/homepage/config`);
    if (!response.ok) return {};
    const payload = await response.json();
    if (!payload?.config_json) return {};
    return JSON.parse(payload.config_json);
  } catch {
    return {};
  }
}

/**
 * Returns posts that have been promoted to spotlight status (is_spotlight = 1).
 * Filters from already-fetched posts array if provided, otherwise fetches fresh.
 */
export async function fetchSpotlightedPosts(posts) {
  const source = posts ?? (await fetchPublishedBriefs(200).catch(() => []));
  return source.filter((p) => p.is_spotlight);
}

export function formatBriefDate(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(ms));
}

export function getBriefPathMeta(path) {
  return BRIEF_PATH_META[path] || BRIEF_PATH_META.productivity;
}

export function getContentTypeMeta(type) {
  return CONTENT_TYPE_META[type] || CONTENT_TYPE_META.daily_brief;
}

export function renderBriefMarkdown(markdown) {
  const blocks = String(markdown || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (/^###\s+/.test(block)) return `<h3>${escapeHtml(block.replace(/^###\s+/, ''))}</h3>`;
      if (/^##\s+/.test(block)) return `<h2>${escapeHtml(block.replace(/^##\s+/, ''))}</h2>`;
      if (/^#\s+/.test(block)) return `<h1>${escapeHtml(block.replace(/^#\s+/, ''))}</h1>`;
      if (/^[-*]\s+/m.test(block)) {
        const items = block
          .split('\n')
          .map((line) => line.replace(/^[-*]\s+/, '').trim())
          .filter(Boolean)
          .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${renderInlineMarkdown(block)}</p>`;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
