import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';

function formatPublishedDate(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(ms));
}

function markdownToHtml(markdown) {
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

function getSlugFromPath() {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/^\/briefs\/([^/]+)\/?$/);
  return match?.[1] || '';
}

export default function BriefArticlePage() {
  const [slug, setSlug] = useState('');
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nextSlug = getSlugFromPath();
    setSlug(nextSlug);
  }, []);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('No article slug was provided.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(apiUrl(`/api/content/posts/${slug}`))
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Article load failed.');
        }
        if (!cancelled) {
          setPost(payload?.post || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Article load failed.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | GreyBrain Academy`;

    const description = post.summary || 'GreyBrain Academy brief for doctors who want to practice, publish, and build.';
    const canonicalUrl = post.canonical_url || `https://edu.greybrain.ai/briefs/${post.slug}`;

    const ensureTag = (selector, create) => {
      let node = document.head.querySelector(selector);
      if (!node) {
        node = create();
        document.head.appendChild(node);
      }
      return node;
    };

    const metaDescription = ensureTag('meta[name="description"]', () => {
      const node = document.createElement('meta');
      node.setAttribute('name', 'description');
      return node;
    });
    metaDescription.setAttribute('content', description);

    const canonical = ensureTag('link[rel="canonical"]', () => {
      const node = document.createElement('link');
      node.setAttribute('rel', 'canonical');
      return node;
    });
    canonical.setAttribute('href', canonicalUrl);
  }, [post]);

  const html = useMemo(() => markdownToHtml(post?.content_markdown || ''), [post]);

  if (loading) {
    return <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">Loading brief...</div>;
  }

  if (error || !post) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Brief unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error || 'This article could not be found.'}</p>
        <a href="/" className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Return to GreyBrain Academy
        </a>
      </div>
    );
  }

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-sm md:p-10">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>{post.path || 'brief'}</span>
        <span>{formatPublishedDate(post.published_at_ms || post.updated_at_ms || post.created_at_ms)}</span>
      </div>
      <h1 className="max-w-4xl text-3xl font-extrabold leading-tight text-slate-950 md:text-5xl">{post.title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{post.summary}</p>

      {Array.isArray(post.tags) && post.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div
        className="brief-prose mt-10 max-w-none text-slate-800"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {Array.isArray(post.source_urls) && post.source_urls.length > 0 && (
        <section className="mt-10 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Sources</h2>
          <div className="mt-3 flex flex-col gap-2">
            {post.source_urls.map((url) => (
              <a
                key={url}
                className="text-sm text-sky-700 underline decoration-slate-300 underline-offset-4"
                href={url}
                rel="noreferrer"
                target="_blank"
              >
                {url}
              </a>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
