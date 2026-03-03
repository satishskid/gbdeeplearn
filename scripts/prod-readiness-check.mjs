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
    if (process.env.RUN_SESSION_SMOKE === '1') {
      await checkAdminSessionCrud();
    } else {
      checks.push({
        name: 'admin_session_crud_smoke',
        ok: true,
        critical: false,
        status: 0,
        details: 'skipped (set RUN_SESSION_SMOKE=1 to enable)'
      });
    }
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

async function checkAdminSessionCrud() {
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-token': ADMIN_TOKEN
  };
  let sessionId = '';
  let cohortId = '';

  try {
    const cohorts = await requestJson(`${WORKER_BASE}/api/admin/cohorts?limit=20`, {
      method: 'GET',
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    const list = Array.isArray(cohorts?.cohorts) ? cohorts.cohorts : [];
    const cohort = list.find((item) => item.pathway === 'path2') || list[0];
    cohortId = cohort?.id || '';
    if (!cohortId) throw new Error('No cohort found for smoke test');

    const startMs = Date.now() + 2 * 24 * 60 * 60 * 1000;
    const endMs = startMs + 45 * 60 * 1000;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const createTitle = `Session CRUD Smoke ${stamp}`;
    const updateTitle = `${createTitle} Updated`;

    const created = await requestJson(`${WORKER_BASE}/api/admin/cohorts/${cohortId}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: createTitle,
        description: 'Automated production smoke validation.',
        starts_at_ms: startMs,
        ends_at_ms: endMs,
        status: 'scheduled',
        meeting_url: 'https://meet.example.com/smoke'
      })
    });
    sessionId = created?.session?.id || '';
    if (!sessionId) throw new Error('Created session id missing');

    const updated = await requestJson(`${WORKER_BASE}/api/admin/sessions/${sessionId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: updateTitle,
        description: 'Updated by smoke check.',
        status: 'live'
      })
    });

    const deleted = await requestJson(`${WORKER_BASE}/api/admin/sessions/${sessionId}/delete`, {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });

    checks.push({
      name: 'admin_session_crud_smoke',
      ok: Boolean(updated?.session?.title === updateTitle && deleted?.deleted === true),
      critical: false,
      status: 200,
      details: `cohort=${cohortId}, session=${sessionId}, updated_title=${updated?.session?.title || ''}, deleted=${deleted?.deleted === true}`
    });
  } catch (error) {
    checks.push({
      name: 'admin_session_crud_smoke',
      ok: false,
      critical: false,
      status: 0,
      details: error instanceof Error ? error.message : 'session_smoke_failed'
    });
    if (sessionId) {
      try {
        await requestJson(`${WORKER_BASE}/api/admin/sessions/${sessionId}/delete`, {
          method: 'POST',
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}

async function requestJson(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let payload = {};
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
      if (!response.ok) {
        throw new Error(payload?.error || payload?.raw || `${response.status} request failed`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 8) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('request failed');
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
