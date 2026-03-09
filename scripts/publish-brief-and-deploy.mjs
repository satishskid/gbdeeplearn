#!/usr/bin/env node

import { execSync } from 'node:child_process';

const apiBase = (process.env.DEEPLEARN_API_BASE_URL || 'https://deeplearn-worker.satish-9f4.workers.dev').replace(/\/+$/, '');
const adminToken = (process.env.ADMIN_API_TOKEN || process.env.DEEPLEARN_ADMIN_TOKEN || '').trim();

const args = process.argv.slice(2);
const options = {
  postId: '',
  slug: '',
  dryRun: false
};

for (const arg of args) {
  if (arg === '--dry-run') options.dryRun = true;
  else if (arg.startsWith('--post-id=')) options.postId = arg.slice('--post-id='.length).trim();
  else if (arg.startsWith('--slug=')) options.slug = arg.slice('--slug='.length).trim();
}

if (!adminToken) {
  console.error('Missing ADMIN_API_TOKEN or DEEPLEARN_ADMIN_TOKEN.');
  process.exit(1);
}

async function main() {
  const target = await resolveTargetPost();
  if (!target) {
    throw new Error('No draft post found to publish.');
  }

  console.log(`Target brief: ${target.title} (${target.id}) [${target.status}]`);

  if (options.dryRun) {
    console.log('Dry run only. No publish or deploy executed.');
    return;
  }

  await publishPost(target.id);
  runCommand('npm run build');
  runCommand('npm run cf:pages:deploy');

  console.log(`Published and deployed: ${target.slug || target.id}`);
}

async function resolveTargetPost() {
  if (options.postId) {
    const posts = await fetchAdminPosts('all');
    return posts.find((post) => String(post.id || '') === options.postId) || null;
  }

  if (options.slug) {
    const posts = await fetchAdminPosts('all');
    return posts.find((post) => String(post.slug || '') === options.slug) || null;
  }

  const draftPosts = await fetchAdminPosts('draft');
  return draftPosts[0] || null;
}

async function fetchAdminPosts(status = 'all') {
  const url = new URL(`${apiBase}/api/admin/content/posts`);
  url.searchParams.set('limit', '50');
  if (status) url.searchParams.set('status', status);

  const response = await fetch(url, {
    headers: {
      'x-admin-token': adminToken
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load content posts.');
  }
  const posts = Array.isArray(payload?.posts) ? payload.posts : [];
  return posts.sort((a, b) => Number(b.updated_at_ms || 0) - Number(a.updated_at_ms || 0));
}

async function publishPost(postId) {
  const response = await fetch(`${apiBase}/api/admin/content/posts/${encodeURIComponent(postId)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    },
    body: JSON.stringify({ status: 'published' })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to publish content post.');
  }
}

function runCommand(command) {
  execSync(command, {
    stdio: 'inherit',
    env: process.env
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
