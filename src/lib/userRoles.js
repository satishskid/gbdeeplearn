import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const ROLE_ALIAS = {
  admin: 'coordinator',
  trainer: 'teacher',
  student: 'learner'
};

function normalizeRole(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return ROLE_ALIAS[normalized] || normalized;
}

function normalizeRoleList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeRole).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => normalizeRole(entry))
      .filter(Boolean);
  }

  return [];
}

function parseEmailEnv(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return new Set();
  }

  return new Set(
    value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

const coordinatorEmails = parseEmailEnv(import.meta.env.PUBLIC_COORDINATOR_EMAILS);
const teacherEmails = parseEmailEnv(import.meta.env.PUBLIC_TEACHER_EMAILS);
const ctoEmails = parseEmailEnv(import.meta.env.PUBLIC_CTO_EMAILS);

function addRole(roles, role) {
  const normalized = normalizeRole(role);
  if (normalized) roles.add(normalized);
}

function applyEmailFallbackRoles(email, roles) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  if (ctoEmails.has(normalizedEmail)) addRole(roles, 'cto');
  if (coordinatorEmails.has(normalizedEmail)) addRole(roles, 'coordinator');
  if (teacherEmails.has(normalizedEmail)) addRole(roles, 'teacher');
}

export async function resolveUserRoles(user) {
  const roles = new Set();

  try {
    const token = await user.getIdTokenResult();
    addRole(roles, token?.claims?.role);
    for (const role of normalizeRoleList(token?.claims?.roles)) {
      addRole(roles, role);
    }
  } catch {
    // Ignore token role failures and continue fallback resolution.
  }

  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    if (snapshot.exists()) {
      const data = snapshot.data();
      addRole(roles, data?.role);
      for (const role of normalizeRoleList(data?.roles)) {
        addRole(roles, role);
      }
    }
  } catch {
    // Firestore role fetch can fail due to rules/network; fallback still applies.
  }

  applyEmailFallbackRoles(user.email, roles);

  if (roles.size === 0) {
    roles.add('learner');
  }

  return Array.from(roles);
}

export function hasRole(roles, role) {
  return new Set(roles).has(normalizeRole(role));
}

export function hasAnyRole(roles, allowedRoles) {
  const roleSet = new Set((roles || []).map(normalizeRole).filter(Boolean));
  return (allowedRoles || []).some((role) => roleSet.has(normalizeRole(role)));
}

export function preferredPlatformTab(roles) {
  const roleSet = new Set((roles || []).map(normalizeRole).filter(Boolean));
  if (roleSet.has('cto')) return 'cto';
  if (roleSet.has('coordinator')) return 'coordinator';
  if (roleSet.has('teacher')) return 'teacher';
  return 'learner';
}
