#!/usr/bin/env node

const adminToken = (process.env.ADMIN_API_TOKEN || process.env.DEEPLEARN_ADMIN_TOKEN || '').trim();
const apiBase = (process.env.DEEPLEARN_API_BASE_URL || 'https://edu.greybrain.ai/api').replace(/\/+$/, '');

if (!adminToken) {
  console.error('Missing ADMIN_API_TOKEN or DEEPLEARN_ADMIN_TOKEN.');
  process.exit(1);
}

const adminHeaders = {
  'content-type': 'application/json',
  'x-admin-token': adminToken
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path, options = {}, retries = 25) {
  let lastError;
  const url = `${apiBase}${path}`;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
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
        throw new Error(`${response.status} ${path} :: ${payload?.error || payload?.raw || 'request failed'}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(Math.min(1000 * attempt, 5000));
      }
    }
  }
  throw lastError;
}

async function run() {
  const cohortsPayload = await fetchJson('/admin/cohorts?limit=20', {
    method: 'GET',
    headers: { 'x-admin-token': adminToken }
  });
  const cohorts = Array.isArray(cohortsPayload?.cohorts) ? cohortsPayload.cohorts : [];
  if (cohorts.length === 0) {
    throw new Error('No cohorts found for smoke test.');
  }

  const cohort = cohorts.find((item) => item.pathway === 'path2') || cohorts[0];
  const now = Date.now();
  const startsAt = now + 2 * 24 * 60 * 60 * 1000;
  const endsAt = startsAt + 60 * 60 * 1000;
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const createTitle = `QA Session Smoke ${stamp}`;
  const updateTitle = `${createTitle} Updated`;

  const created = await fetchJson(`/admin/cohorts/${cohort.id}/sessions`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: createTitle,
      description: 'Automated smoke session for console CRUD verification.',
      starts_at_ms: startsAt,
      ends_at_ms: endsAt,
      status: 'scheduled',
      meeting_url: 'https://meet.example.com/smoke',
      resources: { slides: 'https://docs.example.com/slides' }
    })
  });

  const sessionId = created?.session?.id;
  if (!sessionId) {
    throw new Error('Session creation succeeded but session id missing.');
  }

  const updated = await fetchJson(`/admin/sessions/${sessionId}`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: updateTitle,
      description: 'Updated by automated smoke test.',
      status: 'live'
    })
  });

  const listAfterUpdate = await fetchJson(`/admin/cohorts/${cohort.id}/sessions?limit=200`, {
    method: 'GET',
    headers: { 'x-admin-token': adminToken }
  });

  const updatedRow = (listAfterUpdate.sessions || []).find((row) => row.id === sessionId);
  if (!updatedRow || updatedRow.title !== updateTitle) {
    throw new Error('Session update verification failed in list response.');
  }

  const deleted = await fetchJson(`/admin/sessions/${sessionId}/delete`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken }
  });

  const listAfterDelete = await fetchJson(`/admin/cohorts/${cohort.id}/sessions?limit=200`, {
    method: 'GET',
    headers: { 'x-admin-token': adminToken }
  });

  const stillExists = (listAfterDelete.sessions || []).some((row) => row.id === sessionId);
  if (stillExists) {
    throw new Error('Session delete verification failed; session still present.');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        api_base: apiBase,
        cohort_id: cohort.id,
        created_session_id: sessionId,
        updated_title: updated?.session?.title || null,
        deleted: deleted?.deleted === true,
        verified_absent_after_delete: !stillExists
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
