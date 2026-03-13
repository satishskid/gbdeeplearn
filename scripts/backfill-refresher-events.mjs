#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(rootDir, 'scripts', 'cf-cli.sh');
const isDryRun = process.argv.includes('--dry-run');

function execD1Json(sql) {
  const stdout = execFileSync(
    cliPath,
    ['d1', 'execute', 'deeplearn-ops', '--remote', '--command', sql, '--json'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results || [];
}

function execD1(sql) {
  return execFileSync(
    cliPath,
    ['d1', 'execute', 'deeplearn-ops', '--remote', '--command', sql],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
}

function escapeSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function parseMetadata(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function actorKey(row) {
  return String(row.lead_id || row.session_id || '').trim();
}

function inferPathFromSlug(rawSlug) {
  const slug = String(rawSlug || '').trim().toLowerCase();
  if (!slug) return '';
  if (
    slug.includes('research') ||
    slug.includes('paper') ||
    slug.includes('publication') ||
    slug.includes('in-silico-investigator')
  ) {
    return 'research';
  }
  if (
    slug.includes('venture') ||
    slug.includes('business') ||
    slug.includes('entrepreneur') ||
    slug.includes('super-agents')
  ) {
    return 'entrepreneurship';
  }
  if (
    slug.includes('doctor') ||
    slug.includes('clinical') ||
    slug.includes('healthcare') ||
    slug.includes('productivity')
  ) {
    return 'productivity';
  }
  return '';
}

function buildUpdateSql(id, metadata) {
  return `UPDATE lead_events SET metadata_json = '${escapeSql(JSON.stringify(metadata))}' WHERE id = ${Number(id)};`;
}

function planChapterBackfill(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = actorKey(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const updates = [];
  for (const entries of grouped.values()) {
    const ordered = [...entries].sort((a, b) => Number(a.created_at_ms || 0) - Number(b.created_at_ms || 0));
    const used = new Set();

    for (const entry of ordered) {
      const metadata = parseMetadata(entry.metadata_json);
      const chapterId = String(metadata.chapter_id || '').trim().toLowerCase();
      if (chapterId) used.add(chapterId);
    }

    let pointer = 1;
    for (const entry of ordered) {
      const metadata = parseMetadata(entry.metadata_json);
      if (metadata.chapter_id) continue;

      while (used.has(`chapter-${pointer}`) && pointer <= 5) {
        pointer += 1;
      }
      if (pointer > 5) continue;

      const nextMetadata = { ...metadata, chapter_id: `chapter-${pointer}` };
      used.add(`chapter-${pointer}`);
      updates.push({ id: entry.id, metadata: nextMetadata });
      pointer += 1;
    }
  }

  return updates;
}

function planPathBackfill(rows) {
  const updates = [];
  for (const row of rows) {
    const metadata = parseMetadata(row.metadata_json);
    if (metadata.recommended_path) continue;
    const inferredPath = inferPathFromSlug(row.course_slug || row.course_catalog_slug || '');
    if (!inferredPath) continue;
    updates.push({
      id: row.id,
      metadata: { ...metadata, recommended_path: inferredPath }
    });
  }
  return updates;
}

function main() {
  const chapterRows = execD1Json(`
    SELECT id, lead_id, session_id, created_at_ms, metadata_json
    FROM lead_events
    WHERE event_name = 'refresher_chapter_completed'
    ORDER BY COALESCE(NULLIF(lead_id, ''), NULLIF(session_id, '')), created_at_ms ASC
  `);

  const pathRows = execD1Json(`
    SELECT
      le.id,
      le.lead_id,
      le.session_id,
      le.metadata_json,
      lr.course_slug,
      c.slug AS course_catalog_slug
    FROM lead_events le
    LEFT JOIN lead_registrations lr
      ON (le.lead_id != '' AND lr.lead_id = le.lead_id)
      OR (le.session_id != '' AND lr.session_id = le.session_id)
    LEFT JOIN courses c ON c.id = lr.course_id
    WHERE le.event_name = 'refresher_path_saved'
    ORDER BY le.created_at_ms ASC
  `);

  const chapterUpdates = planChapterBackfill(chapterRows);
  const pathUpdates = planPathBackfill(pathRows);
  const updates = [...chapterUpdates, ...pathUpdates];

  if (!isDryRun && updates.length > 0) {
    for (const update of updates) {
      execD1(buildUpdateSql(update.id, update.metadata));
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: isDryRun ? 'dry-run' : 'apply',
        chapter_updates: chapterUpdates.length,
        path_updates: pathUpdates.length,
        total_updates: updates.length
      },
      null,
      2
    )
  );
}

main();
