import AuthRoleGate from './AuthRoleGate';

export default function LearnerWorkspace() {
  return (
    <AuthRoleGate
      allowedRoles={['learner', 'teacher', 'coordinator', 'cto']}
      title="Learner Hub"
      subtitle="Sign in to access pre-reads, assignment status, and certificate progress."
      unauthorizedMessage="This page requires learner enrollment or teaching/coordinator privileges."
    >
      {({ user, roles, onSignOut }) => (
        <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/85 p-5 shadow-xl backdrop-blur-sm md:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Learner Access</p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Course Workspace</h2>
              <p className="mt-1 text-sm text-slate-600">{user.email || user.uid}</p>
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

          <div className="grid gap-3 md:grid-cols-2">
            {[
              'Pre-read materials unlocked after enrollment',
              'AI Tutor access tied to enrolled course context',
              'Assignment submission and grading milestones',
              'Certificate auto-issuance at 100% completion'
            ].map((item) => (
              <article key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {item}
              </article>
            ))}
          </div>
        </section>
      )}
    </AuthRoleGate>
  );
}
