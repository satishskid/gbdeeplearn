#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const now = new Date();
const runId = now.toISOString().replace(/[:.]/g, '-');

const apiBase = (process.env.DEEPLEARN_API_BASE_URL || 'https://deeplearn-worker.satish-9f4.workers.dev').replace(/\/+$/, '');
const pagesBase = (process.env.DEEPLEARN_PAGES_BASE_URL || 'https://edu.greybrain.ai').replace(/\/+$/, '');
const expectedCoordinatorEmails = (process.env.EXPECTED_COORDINATOR_EMAILS || 'satish@skids.health,drpratichi@skids.health')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const disallowedEmailMarkers = (process.env.DISALLOWED_EMAIL_MARKERS || 'qa.coordinator.')
  .split(',')
  .map((marker) => marker.trim().toLowerCase())
  .filter(Boolean);

const results = [];

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function extractJsonFromOutput(output) {
  const start = output.indexOf('{');
  if (start < 0) return null;
  const jsonText = output.slice(start);
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function runCommand(name, command, options = {}) {
  const {
    env = process.env,
    retries = 1,
    validate
  } = options;

  let lastError = null;
  let finalOutput = '';
  let parsedJson = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const output = execSync(command, {
        env,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024
      });
      finalOutput = output;
      parsedJson = extractJsonFromOutput(output);
      if (typeof validate === 'function') {
        validate({ output, parsedJson });
      }

      results.push({
        name,
        ok: true,
        attempt,
        command,
        details: 'pass'
      });
      return { output, parsedJson };
    } catch (error) {
      lastError = error;
      const stdout = error?.stdout ? String(error.stdout) : '';
      const stderr = error?.stderr ? String(error.stderr) : '';
      finalOutput = `${stdout}\n${stderr}`.trim();
      parsedJson = extractJsonFromOutput(finalOutput);
      if (attempt < retries) continue;
      results.push({
        name,
        ok: false,
        attempt,
        command,
        details: finalOutput.slice(0, 1000) || (error instanceof Error ? error.message : 'command failed')
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${name} failed`);
}

function runCurl(name, url) {
  const { output } = runCommand(name, `curl -fsSL ${shellEscape(url)}`, { retries: 4 });
  return output;
}

function parseRequiredRegex(text, regex, label) {
  const match = text.match(regex);
  if (!match || !match[1]) {
    throw new Error(`Unable to parse ${label}`);
  }
  return match[1];
}

function checkReadinessPayload(payload, requireSessionSmoke = false) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Readiness JSON missing.');
  }
  if (Number(payload.critical_failures || 0) > 0) {
    throw new Error(`critical_failures=${payload.critical_failures}`);
  }
  const checks = Array.isArray(payload.checks) ? payload.checks : [];
  const workerRoot = checks.find((item) => item.name === 'worker_root');
  if (!workerRoot?.ok) {
    throw new Error('worker_root check failed.');
  }
  if (requireSessionSmoke) {
    const smoke = checks.find((item) => item.name === 'admin_session_crud_smoke');
    if (!smoke?.ok || smoke.status !== 200) {
      throw new Error(`admin_session_crud_smoke failed: ${smoke?.details || 'missing'}`);
    }
  }
}

function runRbacBundleGate() {
  const consoleHtml = runCurl('rbac_console_html', `${pagesBase}/console/`);
  const platformWorkspaceBundle = parseRequiredRegex(
    consoleHtml,
    /component-url="\/_astro\/(PlatformWorkspace\.[A-Za-z0-9_-]+\.js)"/,
    'PlatformWorkspace bundle'
  );

  const platformWorkspaceJs = runCurl('rbac_platform_workspace_bundle', `${pagesBase}/_astro/${platformWorkspaceBundle}`);
  const authRoleGateBundle = parseRequiredRegex(
    platformWorkspaceJs,
    /"\.\/(AuthRoleGate\.[A-Za-z0-9_-]+\.js)"/,
    'AuthRoleGate bundle'
  );

  const authRoleGateJs = runCurl('rbac_auth_role_gate_bundle', `${pagesBase}/_astro/${authRoleGateBundle}`).toLowerCase();

  const missing = expectedCoordinatorEmails.filter((email) => !authRoleGateJs.includes(email));
  if (missing.length > 0) {
    throw new Error(`Coordinator allowlist missing: ${missing.join(', ')}`);
  }

  const forbidden = disallowedEmailMarkers.filter((marker) => authRoleGateJs.includes(marker));
  if (forbidden.length > 0) {
    throw new Error(`Disallowed QA markers found in bundle: ${forbidden.join(', ')}`);
  }

  results.push({
    name: 'rbac_bundle_gate',
    ok: true,
    details: `platform=${platformWorkspaceBundle}, auth=${authRoleGateBundle}`
  });
}

function run() {
  if (!(process.env.ADMIN_API_TOKEN || process.env.DEEPLEARN_ADMIN_TOKEN)) {
    throw new Error('Missing ADMIN_API_TOKEN/DEEPLEARN_ADMIN_TOKEN.');
  }

  runCommand('build', 'npm run build', { retries: 1 });

  const baseEnv = {
    ...process.env,
    DEEPLEARN_API_BASE_URL: apiBase,
    DEEPLEARN_PAGES_BASE_URL: pagesBase
  };

  runCommand('readiness', 'npm run readiness:check', {
    env: baseEnv,
    retries: 4,
    validate: ({ parsedJson }) => checkReadinessPayload(parsedJson, false)
  });

  runCommand('readiness_session_smoke', 'npm run readiness:check', {
    env: {
      ...baseEnv,
      RUN_SESSION_SMOKE: '1'
    },
    retries: 4,
    validate: ({ parsedJson }) => checkReadinessPayload(parsedJson, true)
  });

  runRbacBundleGate();
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  results.push({
    name: 'release_gate',
    ok: false,
    details: message
  });
}

const summary = {
  run_id: runId,
  generated_at: now.toISOString(),
  api_base: apiBase,
  pages_base: pagesBase,
  status: results.every((item) => item.ok) ? 'PASS' : 'FAIL',
  checks: results
};

mkdirSync(join(process.cwd(), 'reports'), { recursive: true });
writeFileSync(join(process.cwd(), 'reports', `release-gate-${runId}.json`), JSON.stringify(summary, null, 2));
writeFileSync(join(process.cwd(), 'reports', 'release-gate-latest.json'), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));

if (summary.status !== 'PASS') {
  process.exitCode = 1;
}
