#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEvergreenSeedEntries } from '../src/lib/evergreenContent.js';

const apiBase = (process.env.DEEPLEARN_API_BASE_URL || 'https://deeplearn-worker.satish-9f4.workers.dev').replace(/\/+$/, '');
const adminToken = (process.env.ADMIN_API_TOKEN || process.env.DEEPLEARN_ADMIN_TOKEN || '').trim();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(rootDir, 'scripts', 'cf-cli.sh');

async function seedViaApi() {
  const response = await fetch(`${apiBase}/api/admin/content/seed-evergreen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    },
    body: JSON.stringify({})
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to seed evergreen content.');
  }

  return payload;
}

function escapeSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function buildSeedSql() {
  const nowMs = Date.now();
  const statements = [];

  for (const entry of getEvergreenSeedEntries()) {
    const tagsJson = JSON.stringify(entry.tags || []);
    const sourceUrlsJson = JSON.stringify(entry.source_urls || []);
    const canonicalUrl = `https://edu.greybrain.ai/briefs/${entry.slug}`;
    statements.push(`
INSERT INTO content_posts (
  id, slug, title, summary, content_markdown, path, content_type, tags_json, source_urls_json, canonical_url, model_name,
  prompt_version, status, generated_at_ms, approved_at_ms, published_at_ms, created_at_ms, updated_at_ms
)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
  '${escapeSql(entry.slug)}',
  '${escapeSql(entry.title)}',
  '${escapeSql(entry.summary)}',
  '${escapeSql(entry.content_markdown)}',
  '${escapeSql(entry.path)}',
  '${escapeSql(entry.content_type)}',
  '${escapeSql(tagsJson)}',
  '${escapeSql(sourceUrlsJson)}',
  '${escapeSql(canonicalUrl)}',
  'manual-seed',
  'v1.0.0:seed',
  'published',
  ${nowMs},
  ${nowMs},
  ${nowMs},
  ${nowMs},
  ${nowMs}
WHERE NOT EXISTS (
  SELECT 1 FROM content_posts WHERE slug = '${escapeSql(entry.slug)}'
);`);
  }

  statements.push(`
INSERT INTO content_generation_runs (
  run_type, status, message, post_id, created_at_ms
) VALUES (
  'seed-evergreen',
  'success',
  'Seeded evergreen content through Wrangler D1 fallback.',
  '',
  ${nowMs}
);`);

  return statements.join('\n');
}

function seedViaD1() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gb-evergreen-seed-'));
  const sqlFile = path.join(tempDir, 'seed-evergreen.sql');
  writeFileSync(sqlFile, buildSeedSql(), 'utf8');

  try {
    const stdout = execFileSync(cliPath, ['d1', 'execute', 'deeplearn-ops', '--remote', '--file', sqlFile], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, mode: 'd1-fallback', output: stdout };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  if (adminToken) {
    const payload = await seedViaApi();
    console.log(JSON.stringify({ mode: 'admin-api', ...payload }, null, 2));
    return;
  }

  const payload = seedViaD1();
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
