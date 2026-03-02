import AuthRoleGate from './AuthRoleGate';
import PlatformConsole from './PlatformConsole';

export default function PlatformWorkspace() {
  return (
    <AuthRoleGate
      allowedRoles={['coordinator', 'teacher', 'cto']}
      title="Platform Console"
      subtitle="Sign in with your Firebase account to manage cohorts and operations."
      unauthorizedMessage="This console is restricted to coordinator, teacher, or CTO roles."
    >
      {({ user, roles, onSignOut }) => (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{user.email || user.uid}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Signed in</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(roles || []).map((role) => (
                  <span key={role} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {role}
                  </span>
                ))}
                <button
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  onClick={() => void onSignOut()}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>

          <PlatformConsole userRoles={roles} currentUser={user} />
        </div>
      )}
    </AuthRoleGate>
  );
}
