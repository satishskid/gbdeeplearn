export function getSessionId() {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  const key = 'deeplearn_session_id';
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function hashString(input) {
  let hash = 0;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash * 31 + input.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

export function resolveCtaVariant(sessionId) {
  const source = String(sessionId || '');
  const bucket = hashString(source) % 2;
  return bucket === 0 ? 'A' : 'B';
}

export function markVariantAssigned(variant) {
  if (typeof window === 'undefined') return false;
  const key = `cta_variant_assigned_${variant}`;
  if (window.sessionStorage.getItem(key) === '1') {
    return false;
  }
  window.sessionStorage.setItem(key, '1');
  return true;
}

