import { useState } from 'react';
import AuthRoleGate from './AuthRoleGate';
import { apiUrl } from '../lib/api';

async function actorHeaders(user, roles) {
  const headers = {
    'x-user-id': user?.uid || '',
    'x-user-roles': Array.isArray(roles) ? roles.join(',') : ''
  };

  if (user?.getIdToken) {
    try {
      const idToken = await user.getIdToken();
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
        headers['x-firebase-id-token'] = idToken;
      }
    } catch {
      // Allow caller to fail with server auth error if token fetch fails.
    }
  }

  return headers;
}

async function actorFetch(user, roles, input, init = {}) {
  const identityHeaders = await actorHeaders(user, roles);
  return fetch(input, {
    ...init,
    headers: {
      ...identityHeaders,
      ...(init.headers || {})
    }
  });
}

function hasAnyRole(roles, allowedRoles) {
  const roleSet = new Set((roles || []).map((role) => String(role || '').trim().toLowerCase()).filter(Boolean));
  return (allowedRoles || []).some((role) => roleSet.has(String(role || '').trim().toLowerCase()));
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const [labForm, setLabForm] = useState({
    userId: '',
    courseId: '',
    moduleId: '',
    pathKey: 'research',
    toolType: 'literature-scan',
    provider: 'byok',
    modelName: '',
    input: ''
  });
  const [capstoneForm, setCapstoneForm] = useState({
    userId: '',
    courseId: '',
    moduleId: '',
    cohortId: '',
    pathKey: 'entrepreneurship',
    title: '',
    summary: '',
    artifactUrl: '',
    pitchDeckUrl: '',
    dataRoomUrl: ''
  });
  const [capstoneFilter, setCapstoneFilter] = useState({
    userId: '',
    courseId: '',
    status: ''
  });
  const [reviewForm, setReviewForm] = useState({
    artifactId: '',
    status: 'reviewed',
    score: '',
    passed: 'auto',
    feedback: ''
  });
  const [submissionId, setSubmissionId] = useState('');
  const [access, setAccess] = useState([]);
  const [labRuns, setLabRuns] = useState([]);
  const [capstoneArtifacts, setCapstoneArtifacts] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [loadingLabRuns, setLoadingLabRuns] = useState(false);
  const [loadingCapstones, setLoadingCapstones] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  return (
    <AuthRoleGate
      allowedRoles={['learner', 'teacher', 'coordinator', 'cto']}
      title="Learner Hub"
      subtitle="Sign in to access pre-reads, assignment status, and certificate progress."
      unauthorizedMessage="This page requires learner enrollment or teaching/coordinator privileges."
    >
      {({ user, roles, onSignOut }) => {
        const canReviewCapstones = hasAnyRole(roles, ['teacher', 'coordinator', 'cto']);
        const targetLearnerId = (labForm.userId || capstoneForm.userId || '').trim() || user.uid;

        const loadCapstones = async () => {
          setLoadingCapstones(true);
          setError('');
          try {
            const params = new URLSearchParams();
            params.set('limit', '30');
            if (capstoneFilter.courseId.trim()) params.set('course_id', capstoneFilter.courseId.trim());
            if (capstoneFilter.status.trim()) params.set('status', capstoneFilter.status.trim());
            if (canReviewCapstones) {
              if (capstoneFilter.userId.trim()) params.set('user_id', capstoneFilter.userId.trim());
            } else {
              params.set('user_id', user.uid);
            }

            const response = await actorFetch(user, roles, apiUrl(`/api/learn/capstone/artifacts?${params.toString()}`));
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || 'Failed to load capstones.');
            setCapstoneArtifacts(payload?.artifacts || []);
            setNotice('Capstone artifacts loaded.');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load capstones.');
          } finally {
            setLoadingCapstones(false);
          }
        };

        return (
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

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900">My Access</h3>
                <button
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  type="button"
                  disabled={loadingAccess}
                  onClick={async () => {
                    setLoadingAccess(true);
                    setError('');
                    try {
                      const response = await actorFetch(user, roles, apiUrl(`/api/learn/access?user_id=${encodeURIComponent(user.uid)}`));
                      const payload = await response.json();
                      if (!response.ok) throw new Error(payload?.error || 'Failed to load learner access.');
                      const items = payload?.access || [];
                      setAccess(items);
                      if (items.length > 0) {
                        const first = items[0];
                        const firstUnlockedModule = first.modules?.find((module) => module.is_unlocked) || first.modules?.[0];
                        setStatusForm((prev) => ({
                          ...prev,
                          courseId: first.course_id || '',
                          cohortId: first.cohort?.cohort_id || '',
                          moduleId: firstUnlockedModule?.id || ''
                        }));
                        setAssignmentForm((prev) => ({
                          ...prev,
                          courseId: first.course_id || '',
                          moduleId: firstUnlockedModule?.id || ''
                        }));
                        setLabForm((prev) => ({
                          ...prev,
                          courseId: first.course_id || '',
                          moduleId: firstUnlockedModule?.id || '',
                          userId: prev.userId || user.uid
                        }));
                        setCapstoneForm((prev) => ({
                          ...prev,
                          courseId: first.course_id || '',
                          moduleId: firstUnlockedModule?.id || '',
                          cohortId: first.cohort?.cohort_id || '',
                          userId: prev.userId || user.uid
                        }));
                      }
                      setNotice('Learner access loaded.');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to load learner access.');
                    } finally {
                      setLoadingAccess(false);
                    }
                  }}
                >
                  {loadingAccess ? 'Loading...' : 'Load Access'}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {access.map((item) => (
                  <article key={`${item.course_id}:${item.cohort?.cohort_id || 'self'}`} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{item.course_title || item.course_slug || item.course_id}</p>
                    <p className="text-xs text-slate-600">
                      {item.enrollment_status} · {item.progress_pct}% · cohort {item.cohort?.cohort_id || 'self-paced'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(item.modules || []).slice(0, 6).map((module) => (
                        <span
                          key={module.id}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            module.is_unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {module.module_key}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
                {access.length === 0 ? <p className="text-xs text-slate-500">No enrollments loaded yet.</p> : null}
              </div>
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
                      const response = await actorFetch(
                        user,
                        roles,
                        apiUrl(`/api/learn/modules/${encodeURIComponent(statusForm.moduleId)}/progress`),
                        {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          user_id: user.uid,
                          course_id: statusForm.courseId,
                          cohort_id: statusForm.cohortId,
                          status: statusForm.status,
                          score: statusForm.score
                        })
                        }
                      );
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
                        const response = await actorFetch(
                          user,
                          roles,
                          apiUrl(`/api/learn/assignments/${encodeURIComponent(assignmentForm.moduleId)}/submit`),
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
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
                        const response = await actorFetch(
                          user,
                          roles,
                          apiUrl(`/api/learn/assignments/${encodeURIComponent(submissionId)}/grade`),
                          {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({})
                          }
                        );
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

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-lg font-bold text-slate-900">Run AI Lab Experiment</h3>
                <p className="mt-1 text-xs text-slate-500">Path 2 and Path 3 practice runs with stored outputs.</p>
                <div className="mt-3 grid gap-2">
                  {canReviewCapstones ? (
                    <input
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Target learner user_id (optional)"
                      value={labForm.userId}
                      onChange={(e) => setLabForm((p) => ({ ...p, userId: e.target.value }))}
                    />
                  ) : null}
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Course ID"
                    value={labForm.courseId}
                    onChange={(e) => setLabForm((p) => ({ ...p, courseId: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Module ID"
                    value={labForm.moduleId}
                    onChange={(e) => setLabForm((p) => ({ ...p, moduleId: e.target.value }))}
                  />
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={labForm.pathKey}
                    onChange={(e) => setLabForm((p) => ({ ...p, pathKey: e.target.value }))}
                  >
                    <option value="productivity">Path 1: Productivity</option>
                    <option value="research">Path 2: Research</option>
                    <option value="entrepreneurship">Path 3: Entrepreneurship</option>
                  </select>
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Tool type (e.g., literature-scan)"
                    value={labForm.toolType}
                    onChange={(e) => setLabForm((p) => ({ ...p, toolType: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Provider (e.g., byok)"
                    value={labForm.provider}
                    onChange={(e) => setLabForm((p) => ({ ...p, provider: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Model name (optional)"
                    value={labForm.modelName}
                    onChange={(e) => setLabForm((p) => ({ ...p, modelName: e.target.value }))}
                  />
                  <textarea
                    className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Experiment input"
                    value={labForm.input}
                    onChange={(e) => setLabForm((p) => ({ ...p, input: e.target.value }))}
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
                        const response = await actorFetch(user, roles, apiUrl('/api/lab/run'), {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            user_id: targetLearnerId,
                            course_id: labForm.courseId,
                            module_id: labForm.moduleId,
                            path_key: labForm.pathKey,
                            tool_type: labForm.toolType,
                            provider: labForm.provider,
                            model_name: labForm.modelName,
                            input: labForm.input
                          })
                        });
                        const payload = await response.json();
                        if (!response.ok) throw new Error(payload?.error || 'Failed to run lab.');
                        setLabRuns((current) => [payload?.run, ...(current || [])].slice(0, 20));
                        setNotice(`Lab run saved: ${payload?.run?.id || ''}`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to run lab.');
                      }
                    }}
                  >
                    Run Lab
                  </button>
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    type="button"
                    disabled={loadingLabRuns}
                    onClick={async () => {
                      setLoadingLabRuns(true);
                      setError('');
                      try {
                        const params = new URLSearchParams();
                        params.set('limit', '20');
                        params.set('user_id', targetLearnerId);
                        if (labForm.courseId.trim()) params.set('course_id', labForm.courseId.trim());
                        if (labForm.moduleId.trim()) params.set('module_id', labForm.moduleId.trim());
                        if (labForm.pathKey.trim()) params.set('path_key', labForm.pathKey.trim());
                        const response = await actorFetch(user, roles, apiUrl(`/api/lab/runs?${params.toString()}`));
                        const payload = await response.json();
                        if (!response.ok) throw new Error(payload?.error || 'Failed to load lab runs.');
                        setLabRuns(payload?.runs || []);
                        setNotice('Lab runs loaded.');
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to load lab runs.');
                      } finally {
                        setLoadingLabRuns(false);
                      }
                    }}
                  >
                    {loadingLabRuns ? 'Loading...' : 'Load Runs'}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(labRuns || []).slice(0, 5).map((run) => (
                    <article key={run.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-900">
                        {run.path_key} · {run.tool_type}
                      </p>
                      <p className="text-xs text-slate-600">{run.output?.input_summary || 'No summary'}</p>
                      <p className="text-[11px] text-slate-500">
                        {run.model_name || 'model'} · {run.user_id}
                      </p>
                    </article>
                  ))}
                  {(labRuns || []).length === 0 ? <p className="text-xs text-slate-500">No lab runs loaded.</p> : null}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-lg font-bold text-slate-900">Submit Capstone Artifact</h3>
                <p className="mt-1 text-xs text-slate-500">Used for Path 3 venture capstones and final reviews.</p>
                <div className="mt-3 grid gap-2">
                  {canReviewCapstones ? (
                    <input
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Target learner user_id (optional)"
                      value={capstoneForm.userId}
                      onChange={(e) => setCapstoneForm((p) => ({ ...p, userId: e.target.value }))}
                    />
                  ) : null}
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Course ID"
                    value={capstoneForm.courseId}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, courseId: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Module ID"
                    value={capstoneForm.moduleId}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, moduleId: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Cohort ID (optional)"
                    value={capstoneForm.cohortId}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, cohortId: e.target.value }))}
                  />
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={capstoneForm.pathKey}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, pathKey: e.target.value }))}
                  >
                    <option value="productivity">Path 1: Productivity</option>
                    <option value="research">Path 2: Research</option>
                    <option value="entrepreneurship">Path 3: Entrepreneurship</option>
                  </select>
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Artifact title"
                    value={capstoneForm.title}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, title: e.target.value }))}
                  />
                  <textarea
                    className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Summary"
                    value={capstoneForm.summary}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, summary: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Artifact URL"
                    value={capstoneForm.artifactUrl}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, artifactUrl: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Pitch deck URL (optional)"
                    value={capstoneForm.pitchDeckUrl}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, pitchDeckUrl: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Data room URL (optional)"
                    value={capstoneForm.dataRoomUrl}
                    onChange={(e) => setCapstoneForm((p) => ({ ...p, dataRoomUrl: e.target.value }))}
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
                        const response = await actorFetch(user, roles, apiUrl('/api/learn/capstone/submit'), {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            user_id: targetLearnerId,
                            course_id: capstoneForm.courseId,
                            module_id: capstoneForm.moduleId,
                            cohort_id: capstoneForm.cohortId,
                            path_key: capstoneForm.pathKey,
                            title: capstoneForm.title,
                            summary: capstoneForm.summary,
                            artifact_url: capstoneForm.artifactUrl,
                            pitch_deck_url: capstoneForm.pitchDeckUrl,
                            data_room_url: capstoneForm.dataRoomUrl
                          })
                        });
                        const payload = await response.json();
                        if (!response.ok) throw new Error(payload?.error || 'Failed to submit capstone.');
                        const artifactId = payload?.artifact?.id || '';
                        if (artifactId) {
                          setReviewForm((current) => ({ ...current, artifactId }));
                        }
                        setNotice(`Capstone submitted: ${artifactId}`);
                        await loadCapstones();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to submit capstone.');
                      }
                    }}
                  >
                    Submit Capstone
                  </button>
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    type="button"
                    disabled={loadingCapstones}
                    onClick={() => void loadCapstones()}
                  >
                    {loadingCapstones ? 'Loading...' : 'Load Capstones'}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(capstoneArtifacts || []).slice(0, 5).map((artifact) => (
                    <article key={artifact.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-900">{artifact.title}</p>
                      <p className="text-xs text-slate-600">
                        {artifact.path_key} · {artifact.status} · {artifact.user_id}
                      </p>
                      <p className="text-[11px] text-slate-500">Score: {artifact.score ?? '-'}</p>
                    </article>
                  ))}
                  {(capstoneArtifacts || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No capstone artifacts loaded.</p>
                  ) : null}
                </div>
              </article>
            </div>

            {canReviewCapstones ? (
              <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-lg font-bold text-slate-900">Capstone Review Board</h3>
                <p className="mt-1 text-xs text-slate-500">Teacher/coordinator/CTO only.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Filter by learner user_id"
                    value={capstoneFilter.userId}
                    onChange={(e) => setCapstoneFilter((p) => ({ ...p, userId: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Filter by course ID"
                    value={capstoneFilter.courseId}
                    onChange={(e) => setCapstoneFilter((p) => ({ ...p, courseId: e.target.value }))}
                  />
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={capstoneFilter.status}
                    onChange={(e) => setCapstoneFilter((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="">All statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="needs_revision">Needs revision</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="mt-2">
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    type="button"
                    disabled={loadingCapstones}
                    onClick={() => void loadCapstones()}
                  >
                    {loadingCapstones ? 'Loading...' : 'Refresh Board'}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-2">
                    {(capstoneArtifacts || []).map((artifact) => (
                      <article key={artifact.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{artifact.title}</p>
                          <button
                            className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                            type="button"
                            onClick={() =>
                              setReviewForm((current) => ({
                                ...current,
                                artifactId: artifact.id,
                                score: artifact.score ?? '',
                                status: artifact.status || 'reviewed'
                              }))
                            }
                          >
                            Select
                          </button>
                        </div>
                        <p className="text-xs text-slate-600">
                          {artifact.user_id} · {artifact.course_id} · {artifact.status}
                        </p>
                        {artifact.artifact_url ? (
                          <a
                            href={artifact.artifact_url}
                            className="text-[11px] font-semibold text-sky-700 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open artifact
                          </a>
                        ) : null}
                      </article>
                    ))}
                    {(capstoneArtifacts || []).length === 0 ? (
                      <p className="text-xs text-slate-500">No artifacts found for current filter.</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-bold text-slate-900">Review Action</h4>
                    <div className="mt-2 grid gap-2">
                      <input
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Artifact ID"
                        value={reviewForm.artifactId}
                        onChange={(e) => setReviewForm((p) => ({ ...p, artifactId: e.target.value }))}
                      />
                      <select
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={reviewForm.status}
                        onChange={(e) => setReviewForm((p) => ({ ...p, status: e.target.value }))}
                      >
                        <option value="reviewed">Reviewed</option>
                        <option value="accepted">Accepted</option>
                        <option value="needs_revision">Needs revision</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <input
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Score (0-100, optional)"
                        value={reviewForm.score}
                        onChange={(e) => setReviewForm((p) => ({ ...p, score: e.target.value }))}
                      />
                      <select
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={reviewForm.passed}
                        onChange={(e) => setReviewForm((p) => ({ ...p, passed: e.target.value }))}
                      >
                        <option value="auto">Passed: Auto</option>
                        <option value="true">Passed: Yes</option>
                        <option value="false">Passed: No</option>
                      </select>
                      <textarea
                        className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Review feedback"
                        value={reviewForm.feedback}
                        onChange={(e) => setReviewForm((p) => ({ ...p, feedback: e.target.value }))}
                      />
                    </div>
                    <button
                      className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      type="button"
                      onClick={async () => {
                        if (!reviewForm.artifactId.trim()) {
                          setError('Select or enter an artifact ID to review.');
                          return;
                        }
                        setError('');
                        setNotice('');
                        try {
                          const score = toNumberOrNull(reviewForm.score);
                          const body = {
                            status: reviewForm.status,
                            feedback: reviewForm.feedback
                          };
                          if (score !== null) body.score = score;
                          if (reviewForm.passed === 'true') body.passed = true;
                          if (reviewForm.passed === 'false') body.passed = false;

                          const response = await actorFetch(
                            user,
                            roles,
                            apiUrl(`/api/learn/capstone/${encodeURIComponent(reviewForm.artifactId.trim())}/review`),
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify(body)
                            }
                          );
                          const payload = await response.json();
                          if (!response.ok) throw new Error(payload?.error || 'Failed to review capstone.');
                          setNotice(`Capstone review saved: ${payload?.review?.status || 'reviewed'}`);
                          await loadCapstones();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to review capstone.');
                        }
                      }}
                    >
                      Submit Review
                    </button>
                  </div>
                </div>
              </article>
            ) : null}

            {notice ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
            {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          </section>
        );
      }}
    </AuthRoleGate>
  );
}
