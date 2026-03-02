import { getCourseCatalog } from '../lib/academyData';
import { TRACKS } from '../lib/tracks';

export async function GET() {
  const siteOrigin = 'https://gbdeeplearn.pages.dev';
  const now = new Date().toISOString();

  const staticPaths = [
    '/',
    '/courses',
    '/tracks',
    '/learn',
    '/platform',
    '/research-lab',
    '/venture-studio'
  ];

  const courses = await getCourseCatalog();
  const coursePaths = courses
    .map((course) => String(course?.slug || '').trim())
    .filter(Boolean)
    .map((slug) => `/courses/${slug}`);

  const trackPaths = TRACKS.map((track) => `/tracks/${track.slug}`);
  const urls = [...new Set([...staticPaths, ...coursePaths, ...trackPaths])];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `  <url>
    <loc>${siteOrigin}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${path === '/' ? '1.0' : '0.7'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
