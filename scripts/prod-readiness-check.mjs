#!/usr/bin/env node

const WORKER_BASE = (process.env.DEEPLEARN_API_BASE_URL || 'https://deeplearn-worker.satish-9f4.workers.dev').replace(/\/+$/, '');
const PAGES_BASE = (process.env.DEEPLEARN_PAGES_BASE_URL || '').replace(/\/+$/, '');
const ADMIN_TOKEN = (process.env.ADMIN_API_TOKEN || process.env.DEEPLEARN_ADMIN_TOKEN || '').trim();

const checks = [];

async function run() {
  await checkJson('worker_root', `${WORKER_BASE}/`, { critical: true });
  await checkJson('worker_health', `${WORKER_BASE}/health`, { critical: true });

  if (!ADMIN_TOKEN) {
    checks.push({
      name: 'admin_token_present',
      ok: false,
      critical: true,
      status: 0,
      details: 'Missing ADMIN_API_TOKEN/DEEPLEARN_ADMIN_TOKEN env var'
    });
  } else {
    await checkJson('admin_overview', `${WORKER_BASE}/api/admin/overview`, {
      critical: true,
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    await checkJson('admin_analytics_summary', `${WORKER_BASE}/api/admin/analytics/summary?days=30`, {
      critical: true,
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    await checkJson('admin_crm_leads', `${WORKER_BASE}/api/admin/crm/leads?days=365&limit=5`, {
      critical: true,
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    await checkJson('admin_access_audit', `${WORKER_BASE}/api/admin/access/audit`, {
      critical: true,
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    await checkJson('admin_content_runs', `${WORKER_BASE}/api/admin/content/runs?limit=10`, {
      critical: false,
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    await checkJson('admin_alerts', `${WORKER_BASE}/api/admin/alerts?status=open&limit=10`, {
      critical: false,
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
  }

  await checkJson('counselor_chat', `${WORKER_BASE}/api/chat/counselor`, {
    critical: true,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Share current cohort schedule and fee summary.' })
  });

  if (PAGES_BASE) {
    await checkHead('pages_console', `${PAGES_BASE}/console/`, { critical: false });
    await checkHead('pages_learn', `${PAGES_BASE}/learn/`, { critical: false });
  } else {
    checks.push({
      name: 'pages_url_provided',
      ok: true,
      critical: false,
      status: 0,
      details: 'Skipped Pages URL checks (DEEPLEARN_PAGES_BASE_URL not set)'
    });
  }

  const criticalFailed = checks.filter((item) => item.critical && !item.ok);
  const output = {
    generated_at: new Date().toISOString(),
    worker_base: WORKER_BASE,
    pages_base: PAGES_BASE || '(not provided)',
    critical_failures: criticalFailed.length,
    checks
  };

  console.log(JSON.stringify(output, null, 2));
  if (criticalFailed.length > 0) {
    process.exitCode = 1;
  }
}

async function checkJson(name, url, options = {}) {
  const {
    critical = false,
    method = 'GET',
    headers = {},
    body
  } = options;
  try {
    const response = await fetch(url, { method, headers, body });
    const text = await response.text();
    let payload = {};
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 600) };
    }
    checks.push({
      name,
      ok: response.ok,
      critical,
      status: response.status,
      details: response.ok ? summarizePayload(payload) : summarizePayload(payload)
    });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      critical,
      status: 0,
      details: error instanceof Error ? error.message : 'request_failed'
    });
  }
}

async function checkHead(name, url, options = {}) {
  const { critical = false } = options;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    checks.push({
      name,
      ok: response.ok,
      critical,
      status: response.status,
      details: response.ok ? 'ok' : 'non-2xx response'
    });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      critical,
      status: 0,
      details: error instanceof Error ? error.message : 'request_failed'
    });
  }
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return String(payload || '');
  const keys = Object.keys(payload);
  if (keys.length === 0) return 'empty_payload';
  if (payload.error) return String(payload.error);
  if (payload.status) return `status=${payload.status}`;
  if (payload.ok === true) return 'ok=true';
  if (payload.reply) return `reply=${String(payload.reply).slice(0, 80)}`;
  return `keys=${keys.slice(0, 6).join(',')}`;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
