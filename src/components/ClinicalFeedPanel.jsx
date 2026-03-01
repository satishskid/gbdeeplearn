import { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { formatDisplayDate } from '../lib/academyData';

export default function ClinicalFeedPanel({ initialPosts = [] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPublishedPosts = async () => {
      setLoading(true);
      try {
        const response = await fetch(apiUrl('/api/content/posts?limit=4'));
        const payload = await response.json();
        if (!active || !response.ok) return;
        if (Array.isArray(payload?.posts) && payload.posts.length > 0) {
          setPosts(payload.posts);
        }
      } catch {
        // Keep initial feed fallback.
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPublishedPosts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {posts.map((post) => (
        <article key={`${post.slug || post.link}-${post.date || 'latest'}`} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-rose-700">
            {post.tags?.[0] || post.categories?.[0] || 'Clinical AI'}
          </p>
          <h3 className="mt-2 line-clamp-3 text-base font-bold text-slate-900">{post.title}</h3>
          <p className="mt-2 text-xs text-slate-500">{formatDisplayDate(post.date) || 'Latest'}</p>
          <p className="mt-2 line-clamp-4 text-sm text-slate-600">{post.summary}</p>
          <a
            href={post.link || post.source_urls?.[0] || 'https://greybrain.ai/clinical-ai'}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800"
          >
            Read now -&gt;
          </a>
        </article>
      ))}
      {!loading && posts.length === 0 && (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 lg:col-span-4">
          <p className="text-sm text-slate-600">No published brief yet. Generate today’s draft from the console and publish after review.</p>
        </article>
      )}
    </div>
  );
}
