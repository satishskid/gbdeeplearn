import { useState } from 'react';
import AuthRoleGate from './AuthRoleGate';
import { apiUrl } from '../lib/api';

export default function LearnerWorkspace() {
  const [statusForm, setStatusForm] = useState({
    courseId: '',
    cohortId: '',
    moduleId: '',
    status: 'in_progress',
    score: ''
  });
  const [assignmentForm, setAssignmentForm] = useState({
    courseId: '',
    moduleId: '',
    answerText: ''
  });
  const [submissionId, setSubmissionId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-bold text-slate-900">Update Module Progress</h3>
              <div className="mt-3 grid gap-2">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Course ID"
                  value={statusForm.courseId}
                  onChange={(e) => setStatusForm((p) => ({ ...p, courseId: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Cohort ID (optional)"
                  value={statusForm.cohortId}
                  onChange={(e) => setStatusForm((p) => ({ ...p, cohortId: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Module ID"
                  value={statusForm.moduleId}
                  onChange={(e) => setStatusForm((p) => ({ ...p, moduleId: e.target.value }))}
                />
                <select
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                  <option value="completed">Completed</option>
                </select>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Score (optional)"
                  value={statusForm.score}
                  onChange={(e) => setStatusForm((p) => ({ ...p, score: e.target.value }))}
                />
              </div>
              <button
                className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={async () => {
                  setError('');
                  setNotice('');
                  try {
                    const response = await fetch(apiUrl(`/api/learn/modules/${encodeURIComponent(statusForm.moduleId)}/progress`), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: user.uid,
                        course_id: statusForm.courseId,
                        cohort_id: statusForm.cohortId,
                        status: statusForm.status,
                        score: statusForm.score
                      })
                    });
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload?.error || 'Failed to update progress.');
                    setNotice(`Progress updated: ${payload?.progress?.status || 'ok'}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to update progress.');
                  }
                }}
              >
                Save Progress
              </button>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-bold text-slate-900">Submit Assignment</h3>
              <div className="mt-3 grid gap-2">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Course ID"
                  value={assignmentForm.courseId}
                  onChange={(e) => setAssignmentForm((p) => ({ ...p, courseId: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Module ID"
                  value={assignmentForm.moduleId}
                  onChange={(e) => setAssignmentForm((p) => ({ ...p, moduleId: e.target.value }))}
                />
                <textarea
                  className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Paste your assignment response"
                  value={assignmentForm.answerText}
                  onChange={(e) => setAssignmentForm((p) => ({ ...p, answerText: e.target.value }))}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  type="button"
                  onClick={async () => {
                    setError('');
                    setNotice('');
                    try {
                      const response = await fetch(
                        apiUrl(`/api/learn/assignments/${encodeURIComponent(assignmentForm.moduleId)}/submit`),
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            user_id: user.uid,
                            course_id: assignmentForm.courseId,
                            answer_text: assignmentForm.answerText
                          })
                        }
                      );
                      const payload = await response.json();
                      if (!response.ok) throw new Error(payload?.error || 'Failed to submit assignment.');
                      setSubmissionId(payload?.submission?.id || '');
                      setNotice(`Assignment submitted. Submission ID: ${payload?.submission?.id || ''}`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to submit assignment.');
                    }
                  }}
                >
                  Submit
                </button>
                <button
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  type="button"
                  onClick={async () => {
                    if (!submissionId) {
                      setError('Submit assignment first to get a submission ID.');
                      return;
                    }
                    setError('');
                    setNotice('');
                    try {
                      const response = await fetch(apiUrl(`/api/learn/assignments/${encodeURIComponent(submissionId)}/grade`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      });
                      const payload = await response.json();
                      if (!response.ok) throw new Error(payload?.error || 'Failed to grade assignment.');
                      setNotice(
                        `Graded: ${payload?.result?.score ?? '-'} (${payload?.result?.passed ? 'Passed' : 'Needs revision'})`
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to grade assignment.');
                    }
                  }}
                >
                  Grade Latest
                </button>
              </div>
              {submissionId ? <p className="mt-2 text-xs text-slate-500">Latest submission: {submissionId}</p> : null}
            </article>
          </div>

          {notice ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        </section>
      )}
    </AuthRoleGate>
  );
}
