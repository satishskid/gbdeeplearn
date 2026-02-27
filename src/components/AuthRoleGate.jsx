import { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, persistenceReady } from '../lib/firebase';
import { hasAnyRole, resolveUserRoles } from '../lib/userRoles';

export default function AuthRoleGate({
  allowedRoles,
  title,
  subtitle,
  unauthorizedMessage,
  children
}) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setAuthError('');
      setUser(nextUser);

      if (!nextUser) {
        setRoles([]);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      await persistenceReady.catch(() => {});
      const resolvedRoles = await resolveUserRoles(nextUser);
      if (!active) return;
      setRoles(resolvedRoles);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const isAuthorized = useMemo(() => hasAnyRole(roles, allowedRoles), [allowedRoles, roles]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      setEmail('');
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignOut = async () => {
    await signOut(auth);
  };

  if (authLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-xl">
        <p className="text-sm font-semibold text-slate-600">Checking access...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-xl">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Protected Access</p>
        <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

        <form className="mt-5 grid gap-3 md:max-w-xl" onSubmit={onSubmit}>
          <input
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            type="password"
            autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Please wait...' : isRegisterMode ? 'Create account' : 'Sign in'}
            </button>
            <button
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              type="button"
              onClick={() => setIsRegisterMode((current) => !current)}
            >
              {isRegisterMode ? 'Use existing account' : 'Create new account'}
            </button>
          </div>
          {authError ? <p className="text-sm text-rose-700">{authError}</p> : null}
        </form>
      </section>
    );
  }

  if (!isAuthorized) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-xl">
        <h2 className="text-xl font-extrabold text-rose-900">Access restricted</h2>
        <p className="mt-2 text-sm text-rose-800">{unauthorizedMessage}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
          Signed in as {user.email || user.uid}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(roles || []).map((role) => (
            <span key={role} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700">
              {role}
            </span>
          ))}
        </div>
        <button
          className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700"
          onClick={() => void onSignOut()}
          type="button"
        >
          Sign out
        </button>
      </section>
    );
  }

  if (typeof children === 'function') {
    return children({ user, roles, onSignOut });
  }

  return children;
}
