import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import AuthRoleGate from '../shared/AuthRoleGate';
import { apiUrl } from '../lib/api';
import { db } from '../lib/firebase';

const REFRESHER_STORAGE_KEY = 'greybrain:ai-refresher:v1';
const TUTOR_CONTEXT_STORAGE_KEY = 'deeplearn_context_id';

function loadLocalRefresherState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REFRESHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function setTutorContext(contextId) {
  if (typeof window === 'undefined') return;
  const normalized = String(contextId || '').trim();
  if (normalized) {
    window.localStorage.setItem(TUTOR_CONTEXT_STORAGE_KEY, normalized);
  } else {
    window.localStorage.removeItem(TUTOR_CONTEXT_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent('greybrain:tutor-context-updated', { detail: { contextId: normalized } }));
}

function getModuleStatusLabel(module) {
  if (!module) return 'Locked';
  if (module.progress_status) return String(module.progress_status).replace(/_/g, ' ');
  return module.is_unlocked ? 'Unlocked' : 'Locked';
}

function inferModuleLane(focus) {
  const text = `${focus.courseTitle || ''} ${focus.title || ''} ${focus.moduleKey || ''} ${focus.description || ''}`.toLowerCase();
  if (String(focus.pathKey || '').toLowerCase() === 'research') return 'Publish';
  if (String(focus.pathKey || '').toLowerCase() === 'entrepreneurship') return 'Build';
  if (String(focus.pathKey || '').toLowerCase() === 'productivity') return 'Practice';

  const isResearch =
    /research|paper|manuscript|literature|evidence|review|protocol|study|academic/.test(text);
  const isBuild =
    /venture|startup|pilot|mvp|business|agent|growth|operator|market|capstone/.test(text);

  if (isResearch) return 'Publish';
  if (isBuild) return 'Build';
  return 'Practice';
}

function normalizeLessonList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function buildHeuristicLessonPlan(focus) {
  if (!focus) return null;
  const lane = inferModuleLane(focus);

  if (lane === 'Publish') {
    return {
      lane,
      objectives: [
        'Translate this module into a reproducible research workflow rather than a one-off AI interaction.',
        'Identify what sources, inclusion logic, or evidence constraints should guide the output.',
        'Produce a draft artifact that can survive supervisor or reviewer scrutiny.'
      ],
      artifact: 'A structured evidence note, literature synthesis, reviewer response matrix, or study-planning output.',
      assignmentPrompt:
        'Use the assignment box to turn the lesson into a citation-aware synthesis, protocol summary, or manuscript-support artifact tied to one real paper or question.',
      checklist: [
        'Name the question or protocol clearly.',
        'State what evidence or context the model should use.',
        'Check whether the output is missing citations, design logic, or methodological caveats.'
      ],
      tutorPrompts: [
        'Turn this module into a reproducible literature review workflow.',
        'What would a supervisor challenge in my draft for this lesson?',
        'Convert this topic into a reviewer-response checklist.'
      ]
    };
  }

  if (lane === 'Build') {
    return {
      lane,
      objectives: [
        'Move from a good idea to a workflow or venture artifact that can be tested.',
        'Clarify the user, workflow boundary, and metric that makes this lesson real.',
        'Produce something a mentor can review for pilot or capstone readiness.'
      ],
      artifact: 'A problem brief, workflow map, MVP concept note, pilot KPI sheet, or capstone-ready artifact.',
      assignmentPrompt:
        'Use the assignment box to describe one real healthcare problem, the workflow boundary, and the AI-enabled artifact or pilot plan this module should create.',
      checklist: [
        'Define the user or stakeholder clearly.',
        'State the workflow boundary and human review point.',
        'Show what metric, signal, or pilot outcome would prove this useful.'
      ],
      tutorPrompts: [
        'Turn this lesson into a pilot-ready workflow.',
        'What is the weakest assumption in this capstone direction?',
        'Convert this module into a sharper MVP brief.'
      ]
    };
  }

  return {
    lane,
    objectives: [
      'Use the lesson to improve one real clinical communication or documentation workflow.',
      'Understand what input, review step, and output structure make the workflow reliable.',
      'Produce something that reduces time without weakening clinical judgment.'
    ],
    artifact: 'A prompt playbook, patient-facing explanation, documentation template, or workflow checklist for one clinical use case.',
    assignmentPrompt:
      'Use the assignment box to apply this module to one real workflow such as OPD notes, discharge summaries, follow-up communication, or team handoff.',
    checklist: [
      'State the clinical scenario or workflow clearly.',
      'Define what the AI should and should not do.',
      'Review the draft for unsupported claims, missing caution, and communication clarity.'
    ],
    tutorPrompts: [
      'Explain this module in simpler doctor language.',
      'Turn this lesson into a patient-safe workflow checklist.',
      'What mistakes should I avoid when applying this module in practice?'
    ]
  };
}

function buildModuleLessonPlan(focus) {
  if (!focus) return null;
  const fallback = buildHeuristicLessonPlan(focus);
  const authoredObjectives = normalizeLessonList(focus.lessonObjectives);
  const authoredChecklist = normalizeLessonList(focus.reviewChecklist);
  const authoredTutorPrompts = normalizeLessonList(focus.tutorPrompts);

  return {
    lane: fallback.lane,
    objectives: authoredObjectives.length > 0 ? authoredObjectives : fallback.objectives,
    artifact: String(focus.expectedArtifact || '').trim() || fallback.artifact,
    assignmentPrompt: String(focus.assignmentPrompt || '').trim() || fallback.assignmentPrompt,
    checklist: authoredChecklist.length > 0 ? authoredChecklist : fallback.checklist,
    tutorPrompts: authoredTutorPrompts.length > 0 ? authoredTutorPrompts : fallback.tutorPrompts
  };
}

function LearnerRefresherProgressCard({ user }) {
  const [progress, setProgress] = useState(null);
  const [source, setSource] = useState('loading');

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.uid) return;

      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid, 'learning_progress', 'ai-refresher-for-doctors'));
        if (!active) return;
        if (snapshot.exists()) {
          setProgress(snapshot.data() || {});
          setSource('profile');
          return;
        }
      } catch {
        // Fall back to local state below.
      }

      const local = loadLocalRefresherState();
      if (!active) return;
      setProgress(local);
      setSource(local ? 'device' : 'empty');
    };

    void load();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const completed = Array.isArray(progress?.completed) ? progress.completed : [];
  const recommendation = String(progress?.recommendation || '').trim();
  const progressPct = Math.round((completed.length / 6) * 100);
  const recommendationLabel =
    recommendation === 'productivity' ? 'Practice' : recommendation === 'research' ? 'Publish' : recommendation === 'entrepreneurship' ? 'Build' : '';

  return (
    <div className="rounded-2xl border border-cyan-200 bg-[linear-gradient(180deg,#ffffff,#f6fbff)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-700">AI Refresher</p>
          <h3 className="mt-1 text-lg font-extrabold text-slate-900">Starter-course progress</h3>
          <p className="mt-1 text-sm text-slate-600">
            Continue the interactive orientation before moving into the full GreyBrain cohort.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          {source === 'profile' ? 'Synced to profile' : source === 'device' ? 'Saved on this device' : source === 'loading' ? 'Loading' : 'Not started'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Progress</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{completed.length}/6</p>
          <p className="text-sm text-slate-600">{progressPct}% complete</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recommended path</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{recommendationLabel || 'Pending completion'}</p>
          <p className="text-sm text-slate-600">{recommendationLabel ? 'Saved from refresher completion.' : 'Finish the refresher to unlock this.'}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Next action</p>
          <a href="/courses/ai-refresher-for-doctors" className="mt-2 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Continue Refresher
          </a>
        </article>
      </div>
    </div>
  );
}

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
  const [sessions, setSessions] = useState([]);
  const [labRuns, setLabRuns] = useState([]);
  const [capstoneArtifacts, setCapstoneArtifacts] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [checkingInSessionId, setCheckingInSessionId] = useState('');
  const [loadingLabRuns, setLoadingLabRuns] = useState(false);
  const [loadingCapstones, setLoadingCapstones] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showLabStudio, setShowLabStudio] = useState(false);
  const [showCapstoneStudio, setShowCapstoneStudio] = useState(false);
  const [showReviewBoard, setShowReviewBoard] = useState(false);
  const [activeFocus, setActiveFocus] = useState(null);
  const [quizStatus, setQuizStatus] = useState({ passed: false, score: 0 });
  const [showQuiz, setShowQuiz] = useState(false);

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

        const applyModuleContext = (courseItem, module) => {
          const courseId = courseItem?.course_id || '';
          const cohortId = courseItem?.cohort?.cohort_id || '';
          const moduleId = module?.id || '';
          const moduleKey = module?.module_key || module?.id || '';
          const title = module?.title || module?.module_key || 'Current module';
          const statusLabel = getModuleStatusLabel(module);
          const progressValue = String(module?.progress_status || '').toLowerCase();
          const recommendedStatus = progressValue === 'completed' ? 'completed' : progressValue === 'submitted' ? 'submitted' : 'in_progress';

          setStatusForm((prev) => ({
            ...prev,
            courseId,
            cohortId,
            moduleId,
            status: recommendedStatus
          }));
          setAssignmentForm((prev) => ({
            ...prev,
            courseId,
            moduleId
          }));
          setLabForm((prev) => ({
            ...prev,
            courseId,
            moduleId,
            userId: prev.userId || user.uid
          }));
          setCapstoneForm((prev) => ({
            ...prev,
            courseId,
            moduleId,
            cohortId,
            userId: prev.userId || user.uid
          }));
          setActiveFocus({
            courseId,
            courseTitle: courseItem?.course_title || courseItem?.course_slug || courseId,
            cohortId,
            moduleId,
            moduleKey,
            pathKey: module?.path_key || '',
            title,
            statusLabel,
            progressPct: Number(courseItem?.progress_pct || 0),
            enrollmentStatus: courseItem?.enrollment_status || 'active',
            description: module?.description || '',
            estimatedMinutes: Number(module?.estimated_minutes || 0),
            expectedArtifact: module?.expected_artifact || '',
            assignmentPrompt: module?.assignment_prompt || '',
            lessonObjectives: Array.isArray(module?.lesson_objectives) ? module.lesson_objectives : [],
            reviewChecklist: Array.isArray(module?.review_checklist) ? module.review_checklist : [],
            tutorPrompts: Array.isArray(module?.tutor_prompts) ? module.tutor_prompts : []
          });
          setTutorContext(moduleKey || moduleId);
          
          // Fetch Quiz Status (Phase 3)
          if (moduleId) {
            async function checkQuiz() {
              try {
                const res = await actorFetch(user, roles, apiUrl(`/api/learn/quiz/${moduleId}`));
                const data = await res.json();
                if (res.ok) {
                  setQuizStatus(data.status || { passed: false, score: 0 });
                  if (data.status?.passed === false) setShowQuiz(true);
                }
              } catch (e) { console.error('Quiz status check failed', e); }
            }
            checkQuiz();
          }
        };

        const checkForActiveLiveSession = async (cohortId) => {
          if (!cohortId) return null;
          try {
            const response = await actorFetch(user, roles, apiUrl(`/api/learner/live/session/${cohortId}`));
            const payload = await response.json();
            if (!response.ok) return null;
            return payload.session;
          } catch {
            return null;
          }
        };

        const logAttendance = async (sessionId, status) => {
          try {
            await actorFetch(user, roles, apiUrl('/api/learner/live/attendance'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: sessionId,
                status: status || 'present'
              })
            });
          } catch (err) {
            console.error('Failed to log attendance:', err);
          }
        };

        const loadAccess = async () => {
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
              if (firstUnlockedModule) {
                applyModuleContext(first, firstUnlockedModule);
              }
            }
            setNotice('Learner access loaded.');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load learner access.');
          } finally {
            setLoadingAccess(false);
          }
        };

        const loadSessions = async () => {
          setLoadingSessions(true);
          setError('');
          try {
            const params = new URLSearchParams();
            params.set('user_id', user.uid);
            params.set('limit', '30');
            if (statusForm.courseId.trim()) params.set('course_id', statusForm.courseId.trim());
            const response = await actorFetch(user, roles, apiUrl(`/api/learn/sessions?${params.toString()}`));
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || 'Failed to load sessions.');
            setSessions(payload?.sessions || []);
            setNotice('Sessions loaded.');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sessions.');
          } finally {
            setLoadingSessions(false);
          }
        };

        const checkInSession = async (sessionId) => {
          setCheckingInSessionId(sessionId);
          setError('');
          try {
            const response = await actorFetch(user, roles, apiUrl(`/api/learn/sessions/${encodeURIComponent(sessionId)}/checkin`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.uid })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || 'Failed to check in.');
            setNotice('Session check-in recorded.');
            await loadSessions();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check in.');
          } finally {
            setCheckingInSessionId('');
          }
        };

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

        const enrolledCoursesCount = access.length;
        const unlockedModulesCount = access.reduce(
          (total, item) => total + ((item.modules || []).filter((module) => module.is_unlocked).length || 0),
          0
        );
        const attendedSessionsCount = sessions.filter(
          (session) => String(session.attendance_status || '').toLowerCase() === 'present'
        ).length;
        const submittedCapstoneCount = capstoneArtifacts.filter((artifact) =>
          ['submitted', 'reviewed', 'accepted'].includes(String(artifact.status || '').toLowerCase())
        ).length;
        const lessonPlan = buildModuleLessonPlan(activeFocus);

        return (
          <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,255,0.96))] shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_28%),linear-gradient(135deg,#081427_0%,#0f172a_58%,#12324f_100%)] px-5 py-6 text-white md:px-8 md:py-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                    GreyBrain learner workspace
                  </p>
                  <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">Learn with a clear next step, not a pile of tools.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 md:text-[0.95rem]">
                    Your pre-reads, live sessions, assignments, tutor support, and capstone work now sit in one calmer learning surface.
                    The goal is simple: reduce friction between enrollment and completion.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      'Pre-read access after enrollment',
                      'AI tutor aligned to enrolled course context',
                      'Assignments, sessions, and certificate progress',
                      'Capstone and review flow for advanced cohorts'
                    ].map((item) => (
                      <span key={item} className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-medium text-slate-100">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(roles || []).map((role) => (
                    <span key={role} className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-semibold capitalize text-white">
                      {role}
                    </span>
                  ))}
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                    onClick={() => void onSignOut()}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Enrolled courses</p>
                  <p className="mt-2 text-3xl font-extrabold">{enrolledCoursesCount}</p>
                  <p className="text-xs text-slate-200">Courses unlocked in your current account.</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Unlocked modules</p>
                  <p className="mt-2 text-3xl font-extrabold">{unlockedModulesCount}</p>
                  <p className="text-xs text-slate-200">Available modules across current enrollments.</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Session attendance</p>
                  <p className="mt-2 text-3xl font-extrabold">{attendedSessionsCount}</p>
                  <p className="text-xs text-slate-200">Sessions already checked in or attended.</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Capstone artifacts</p>
                  <p className="mt-2 text-3xl font-extrabold">{submittedCapstoneCount}</p>
                  <p className="text-xs text-slate-200">Submitted or reviewed project artifacts.</p>
                </article>
              </div>
            </div>

            <div className="space-y-6 px-5 py-6 md:px-8 md:py-8">
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-700">My access</p>
                      <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Courses, cohorts, and unlocked modules</h3>
                      <p className="mt-1 text-sm text-slate-600">{user.email || user.uid}</p>
                    </div>
                    <button
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      type="button"
                      disabled={loadingAccess}
                      onClick={() => void loadAccess()}
                    >
                      {loadingAccess ? 'Loading...' : 'Refresh access'}
                    </button>
                  </div>

                  {activeFocus ? (
                    <article className="mt-4 rounded-[1.4rem] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff,#ffffff)] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-2xl">
                          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-sky-700">Current module focus</p>
                          <h4 className="mt-1 text-lg font-extrabold text-slate-900">{activeFocus.title}</h4>
                          <p className="mt-1 text-sm text-slate-600">
                            {activeFocus.courseTitle} · {activeFocus.statusLabel} · {activeFocus.progressPct}% course progress
                          </p>
                          {activeFocus.description ? <p className="mt-3 text-sm leading-6 text-slate-700">{activeFocus.description}</p> : null}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tutor context</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{activeFocus.moduleKey || activeFocus.moduleId}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => {
                            setTutorContext(activeFocus.moduleKey || activeFocus.moduleId);
                            window.location.hash = 'learner-tutor';
                          }}
                        >
                          Study with AI tutor
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          onClick={() => {
                            setStatusForm((prev) => ({ ...prev, status: 'in_progress' }));
                            window.location.hash = 'learner-course-actions';
                          }}
                        >
                          Mark progress
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          onClick={() => {
                            window.location.hash = 'learner-course-actions';
                          }}
                        >
                          Open assignment flow
                        </button>
                      </div>
                    </article>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {access.map((item) => (
                      <article key={`${item.course_id}:${item.cohort?.cohort_id || 'self'}`} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-slate-900">{item.course_title || item.course_slug || item.course_id}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {item.enrollment_status} · {item.progress_pct}% complete · cohort {item.cohort?.cohort_id || 'self-paced'}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            {(item.modules || []).filter((module) => module.is_unlocked).length} unlocked
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(item.modules || []).slice(0, 8).map((module) => {
                            const isActive = activeFocus?.moduleId === module.id && activeFocus?.courseId === item.course_id;
                            return (
                              <button
                                key={module.id}
                                type="button"
                                onClick={() => applyModuleContext(item, module)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                                  isActive
                                    ? 'border border-sky-300 bg-sky-100 text-sky-900'
                                    : module.is_unlocked
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                              >
                                {module.module_key}
                              </button>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                    {access.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                          <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <h4 className="mt-4 text-sm font-bold text-slate-900">Start your learning journey</h4>
                        <p className="mt-1 text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                          You aren't enrolled in any courses yet. Browse our catalog to find your next step.
                        </p>
                        <a 
                          href="/courses" 
                          className="mt-5 inline-flex h-9 items-center rounded-xl bg-slate-900 px-5 text-xs font-bold text-white shadow-lg shadow-slate-200 transition active:scale-95"
                        >
                          Explore Academy
                        </a>
                      </div>
                    ) : null}
                  </div>
                </section>

                <div className="space-y-6">
                  <LearnerRefresherProgressCard user={user} />

                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Live learning</p>
                        <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Sessions and attendance</h3>
                        <p className="mt-1 text-sm text-slate-600">Join live cohorts, open recordings, and check in when sessions start.</p>
                      </div>
                      <button
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        type="button"
                        disabled={loadingSessions}
                        onClick={() => void loadSessions()}
                      >
                        {loadingSessions ? 'Loading...' : 'Refresh sessions'}
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* --- ACTIVE SESSION HIGHLIGHT --- */}
                      {access.map(item => {
                        const cohortId = item.cohort?.cohort_id;
                        if (!cohortId) return null;
                        return (
                          <div key={`active-live-${cohortId}`} className="group relative">
                             <CohortActiveSessionWidget 
                               cohortId={cohortId} 
                               onJoin={(session) => {
                                 logAttendance(session.id, 'present');
                                 // Future: window.open(`/live/${session.id}`, '_blank');
                               }}
                               actorFetch={actorFetch}
                               user={user}
                               roles={roles}
                             />
                          </div>
                        );
                      })}

                      {(sessions || []).slice(0, 6).map((session) => {
                        const startText = Number.isFinite(Number(session.starts_at_ms))
                          ? new Date(Number(session.starts_at_ms)).toLocaleString()
                          : 'Time TBA';
                        const attendanceStatus = String(session.attendance_status || '').toLowerCase();
                        const canCheckIn = ['scheduled', 'live'].includes(String(session.status || '').toLowerCase());
                        return (
                          <article key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                                <p className="mt-1 text-xs text-slate-600">{startText}</p>
                              </div>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                {session.status}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">Attendance: {attendanceStatus || 'not checked in'}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {session.meeting_url ? (
                                <a
                                  className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800"
                                  href={session.meeting_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Join session
                                </a>
                              ) : null}
                              {session.recording_url ? (
                                <a
                                  className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-800"
                                  href={session.recording_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open recording
                                </a>
                              ) : null}
                              {canCheckIn && attendanceStatus !== 'present' ? (
                                <button
                                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800"
                                  type="button"
                                  disabled={checkingInSessionId === session.id}
                                  onClick={() => void checkInSession(session.id)}
                                >
                                  {checkingInSessionId === session.id ? 'Checking in...' : 'Check in'}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                      {sessions.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 p-6 text-center">
                          <p className="text-xs font-medium text-slate-500">
                            No live sessions are scheduled for your enrolled cohorts at the moment.
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Check back later or join the community discord for updates.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
              </div>

              {lessonPlan && activeFocus ? (
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-3xl">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-700">Lesson brief</p>
                      <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{activeFocus.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        This module is currently being framed as a <span className="font-semibold text-slate-900">{lessonPlan.lane}</span> lesson.
                        Use the objectives, output target, and checklist below to keep the assignment and tutor work aligned.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Expected output</p>
                      <p className="mt-2 max-w-sm text-sm font-semibold text-slate-900">{lessonPlan.artifact}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <article className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Learning objectives</p>
                      <div className="mt-3 space-y-2">
                        {lessonPlan.objectives.map((item) => (
                          <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Assignment and review guide</p>
                      <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700">
                        {lessonPlan.assignmentPrompt}
                      </p>
                      <div className="mt-3 space-y-2">
                        {lessonPlan.checklist.map((item) => (
                          <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => {
                            setAssignmentForm((prev) => ({
                              ...prev,
                              answerText: lessonPlan.assignmentPrompt
                            }));
                            window.location.hash = 'learner-course-actions';
                          }}
                        >
                          Use as assignment brief
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          onClick={() => {
                            setTutorContext(activeFocus.moduleKey || activeFocus.moduleId);
                            window.location.hash = 'learner-tutor';
                          }}
                        >
                          Open tutor for this lesson
                        </button>
                      </div>
                    </article>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tutor starters for this lesson</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lessonPlan.tutorPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          onClick={() => {
                            setTutorContext(activeFocus.moduleKey || activeFocus.moduleId);
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('greybrain:tutor-draft-updated', { detail: { message: prompt } }));
                            }
                            window.location.hash = 'learner-tutor';
                          }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              <section id="learner-course-actions" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Course actions</p>
                  <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Progress and assignment flow</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    This is the working layer of the cohort: mark module progress, submit assignments, and request grading without leaving the learner hub.
                  </p>
                  {activeFocus ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Working on <span className="font-semibold text-slate-900">{activeFocus.title}</span> in{' '}
                      <span className="font-semibold text-slate-900">{activeFocus.courseTitle}</span>.
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
                    <h4 className="text-lg font-bold text-slate-900">Update module progress</h4>
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
                      Save progress
                    </button>
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
                    <h4 className="text-lg font-bold text-slate-900">Submit assignment</h4>
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
                        Grade latest
                      </button>
                    </div>
                    {submissionId ? <p className="mt-2 text-xs text-slate-500">Latest submission: {submissionId}</p> : null}
                  </article>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Applied studio</p>
                    <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Labs, projects, and capstones</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Advanced work now sits in a dedicated studio area. Learners can open only what they need. Teachers and coordinators can still operate review flows without making the whole page feel like an admin panel.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      onClick={() => setShowLabStudio((value) => !value)}
                    >
                      {showLabStudio ? 'Hide AI lab' : 'Open AI lab'}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      onClick={() => setShowCapstoneStudio((value) => !value)}
                    >
                      {showCapstoneStudio ? 'Hide capstones' : 'Open capstones'}
                    </button>
                    {canReviewCapstones ? (
                      <button
                        type="button"
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        onClick={() => setShowReviewBoard((value) => !value)}
                      >
                        {showReviewBoard ? 'Hide review board' : 'Open review board'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {showLabStudio ? (
                    <article className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
                      <h4 className="text-lg font-bold text-slate-900">Run AI lab experiment</h4>
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
                          Run lab
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
                          {loadingLabRuns ? 'Loading...' : 'Load runs'}
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
                  ) : null}

                  {showCapstoneStudio ? (
                    <article className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
                      <h4 className="text-lg font-bold text-slate-900">Submit capstone artifact</h4>
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
                          Submit capstone
                        </button>
                        <button
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                          type="button"
                          disabled={loadingCapstones}
                          onClick={() => void loadCapstones()}
                        >
                          {loadingCapstones ? 'Loading...' : 'Load capstones'}
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
                  ) : null}
                </div>
              </section>

              {canReviewCapstones && showReviewBoard ? (
                <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="max-w-3xl">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">Review board</p>
                    <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Teacher and coordinator capstone review</h3>
                    <p className="mt-1 text-sm text-slate-600">Visible only to teaching and operations roles.</p>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
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
                  <div className="mt-3">
                    <button
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                      type="button"
                      disabled={loadingCapstones}
                      onClick={() => void loadCapstones()}
                    >
                      {loadingCapstones ? 'Loading...' : 'Refresh board'}
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
                      <h4 className="text-sm font-bold text-slate-900">Review action</h4>
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
                        Submit review
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {notice ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
              {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

              {showQuiz && activeFocus?.moduleId ? (
                <AIQuizOverlay 
                  moduleId={activeFocus.moduleId}
                  user={user}
                  roles={roles}
                  actorFetch={actorFetch}
                  onPassed={() => {
                    setQuizStatus({ passed: true, score: 90 });
                    setShowQuiz(false);
                    setNotice('AI Knowledge Check Passed! Assignment submission unlocked.');
                  }}
                  onClose={() => setShowQuiz(false)}
                />
              ) : null}
            </div>
          </section>
        );
      }}
    </AuthRoleGate>
  );
}

function AIQuizOverlay({ moduleId, user, roles, actorFetch, onPassed, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadQuiz() {
      try {
        const res = await actorFetch(user, roles, apiUrl(`/api/learn/quiz/${moduleId}`));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load quiz');
        setQuiz(data);
        if (data.status?.passed) {
          onPassed && onPassed();
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [moduleId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await actorFetch(user, roles, apiUrl(`/api/learn/quiz/${moduleId}/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResult(data);
      if (data.passed) {
        setTimeout(() => onPassed && onPassed(), 1500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-700">AI Knowledge Check</p>
            <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Module Mastery Quiz</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">{error}</p>}

        {result ? (
          <div className="mt-8 text-center">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${result.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              <span className="text-2xl font-bold">{result.score}%</span>
            </div>
            <h4 className="mt-4 text-xl font-bold text-slate-900">{result.passed ? 'Mastery Confirmed!' : 'Keep Learning'}</h4>
            <p className="mt-2 text-slate-600">
              {result.passed 
                ? 'You have successfully passed the AI Knowledge Check. Assignment submission is now unlocked.' 
                : `You scored ${result.score}%. You need 80% to pass. Review the module content and try again.`}
            </p>
            {!result.passed && (
              <button 
                onClick={() => setResult(null)}
                className="mt-6 w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white shadow-lg shadow-slate-200"
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {quiz?.questions?.map((q, idx) => (
              <div key={q.id || idx} className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">{idx + 1}. {q.question}</p>
                <div className="grid gap-2">
                  {q.options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: oIdx }))}
                      className={`flex items-center rounded-xl border px-4 py-3 text-sm transition ${
                        answers[q.id] === oIdx 
                          ? 'border-cyan-500 bg-cyan-50 font-bold text-cyan-900' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`mr-3 flex h-5 w-5 items-center justify-center rounded-full border ${answers[q.id] === oIdx ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300'}`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              disabled={submitting || Object.keys(answers).length < (quiz?.questions?.length || 0)}
              onClick={handleSubmit}
              className="mt-4 w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white shadow-lg shadow-slate-200 disabled:opacity-50"
            >
              {submitting ? 'Validating Answers...' : 'Submit Answers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CohortActiveSessionWidget({ cohortId, onJoin, actorFetch, user, roles }) {
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await actorFetch(user, roles, apiUrl(`/api/learner/live/session/${cohortId}`));
        const payload = await response.json();
        if (active && response.ok && payload.session) {
          setActiveSession(payload.session);
        } else if (active) {
          setActiveSession(null);
        }
      } catch (err) {
        console.error('Active session check failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void check();
    const interval = setInterval(check, 60000); // Check every minute
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cohortId, user?.uid]);

  if (loading || !activeSession) return null;

  return (
    <div className="mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/50 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg">
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-500 animate-ping" />
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-400" />
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Live Now</span>
              <span className="h-1 w-1 rounded-full bg-rose-300" />
              <span className="text-[10px] font-medium text-rose-500">Ultra-low latency</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">{activeSession.title}</h4>
            <p className="text-[11px] text-slate-600 line-clamp-1">{activeSession.description || 'Live teaching session in progress...'}</p>
          </div>
        </div>
        <button
          onClick={() => onJoin(activeSession)}
          className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-700 hover:scale-105 active:scale-95"
          type="button"
        >
          Join Broadcast
        </button>
      </div>
    </div>
  );
}
