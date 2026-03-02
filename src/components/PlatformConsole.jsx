import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';
import { preferredPlatformTab } from '../lib/userRoles';

const ROLE_TABS = [
  { id: 'coordinator', label: 'Course Coordinator' },
  { id: 'teacher', label: 'Teacher / Trainer' },
  { id: 'learner', label: 'Visitor + Learner' },
  { id: 'cto', label: 'CTO / Platform Admin' }
];

function parseMoneyToCents(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

export default function PlatformConsole({ userRoles = [] }) {
  const [adminToken, setAdminToken] = useState('');
  const [overview, setOverview] = useState(null);
  const [courses, setCourses] = useState([]);
  const [contentPosts, setContentPosts] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [courseModules, setCourseModules] = useState([]);
  const [rubricModules, setRubricModules] = useState([]);
  const [unlockModules, setUnlockModules] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [cohortEnrollments, setCohortEnrollments] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [pathAnalytics, setPathAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [courseForm, setCourseForm] = useState({
    title: '',
    slug: '',
    price: '',
    startDate: '',
    endDate: ''
  });

  const [staffForm, setStaffForm] = useState({
    courseId: '',
    email: '',
    displayName: ''
  });

  const [enrollForm, setEnrollForm] = useState({
    courseId: '',
    email: '',
    displayName: ''
  });

  const [completeForm, setCompleteForm] = useState({
    courseId: '',
    userId: '',
    certificateUrl: ''
  });

  const [organizationForm, setOrganizationForm] = useState({
    slug: '',
    name: '',
    color: '#0f172a',
    logoUrl: ''
  });

  const [moduleForm, setModuleForm] = useState({
    courseId: '',
    pathKey: 'productivity',
    moduleKey: '',
    title: '',
    description: '',
    labType: '',
    unlockPolicy: 'cohort',
    estimatedMinutes: '30'
  });

  const [cohortForm, setCohortForm] = useState({
    orgId: '',
    courseId: '',
    name: '',
    mode: 'instructor-led',
    status: 'draft',
    startDate: '',
    endDate: '',
    instructorUserId: '',
    fee: ''
  });

  const [unlockForm, setUnlockForm] = useState({
    cohortId: '',
    moduleId: ''
  });

  const [cohortEnrollForm, setCohortEnrollForm] = useState({
    cohortId: '',
    email: '',
    displayName: '',
    userId: ''
  });

  const [rubricForm, setRubricForm] = useState({
    rubricId: '',
    courseId: '',
    moduleId: '',
    title: '',
    passThreshold: '70',
    rubricJson: '{\n  "criteria": [\n    "Clinical clarity",\n    "Methodological correctness",\n    "Evidence-backed reasoning"\n  ]\n}'
  });

  const roleSet = useMemo(() => new Set((userRoles || []).map((role) => String(role).trim().toLowerCase())), [userRoles]);
  const isCtoUser = roleSet.has('cto');
  const isCoordinatorUser = isCtoUser || roleSet.has('coordinator');
  const isTeacherUser = roleSet.has('teacher');
  const isLearnerUser = isCoordinatorUser || isTeacherUser || roleSet.has('learner');

  const availableTabs = useMemo(() => {
    return ROLE_TABS.filter((tab) => {
      if (isCoordinatorUser) return true;
      if (tab.id === 'teacher') return isTeacherUser;
      if (tab.id === 'learner') return isLearnerUser;
      return false;
    });
  }, [isCoordinatorUser, isTeacherUser, isLearnerUser]);

  const defaultTab = useMemo(() => {
    const preferred = preferredPlatformTab(Array.from(roleSet));
    if (availableTabs.some((tab) => tab.id === preferred)) return preferred;
    return availableTabs[0]?.id || 'learner';
  }, [roleSet, availableTabs]);

  const [activeRole, setActiveRole] = useState(defaultTab);

  const adminHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken.trim()) {
      headers['x-admin-token'] = adminToken.trim();
    }
    return headers;
  }, [adminToken]);

  const loadModulesRaw = async (courseId, headers = adminHeaders) => {
    if (!courseId) {
      return [];
    }

    const response = await fetch(apiUrl(`/api/admin/courses/${courseId}/modules`), { headers });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Module load failed.');
    return payload.modules || [];
  };

  const fetchCourseModules = async (courseId, headers = adminHeaders) => {
    if (!courseId) {
      setCourseModules([]);
      return;
    }
    const modules = await loadModulesRaw(courseId, headers);
    setCourseModules(modules);
  };

  const fetchCourseRubrics = async (courseId, headers = adminHeaders) => {
    if (!courseId) {
      setRubrics([]);
      return;
    }
    const response = await fetch(apiUrl(`/api/admin/courses/${courseId}/rubrics`), { headers });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Rubric load failed.');
    setRubrics(payload.rubrics || []);
  };

  const fetchCohortEnrollments = async (cohortId, headers = adminHeaders) => {
    if (!cohortId) {
      setCohortEnrollments([]);
      return;
    }
    const response = await fetch(apiUrl(`/api/admin/cohorts/${cohortId}/enrollments`), { headers });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Cohort enrollment load failed.');
    setCohortEnrollments(payload.enrollments || []);
  };

  const loadConsoleData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, coursesRes, contentRes, organizationsRes, cohortsRes, analyticsSummaryRes, pathAnalyticsRes] = await Promise.all([
        fetch(apiUrl('/api/admin/overview'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/courses'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/content/posts?limit=20'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/organizations?limit=50'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/cohorts?limit=50'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/analytics/summary?days=30'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/analytics/paths?days=30'), { headers: adminHeaders })
      ]);

      const overviewPayload = await overviewRes.json();
      const coursesPayload = await coursesRes.json();
      const contentPayload = await contentRes.json();
      const organizationsPayload = await organizationsRes.json();
      const cohortsPayload = await cohortsRes.json();
      const analyticsSummaryPayload = await analyticsSummaryRes.json();
      const pathAnalyticsPayload = await pathAnalyticsRes.json();

      if (!overviewRes.ok) throw new Error(overviewPayload?.error || 'Overview load failed.');
      if (!coursesRes.ok) throw new Error(coursesPayload?.error || 'Courses load failed.');
      if (!contentRes.ok) throw new Error(contentPayload?.error || 'Content load failed.');
      if (!organizationsRes.ok) throw new Error(organizationsPayload?.error || 'Organizations load failed.');
      if (!cohortsRes.ok) throw new Error(cohortsPayload?.error || 'Cohorts load failed.');
      if (!analyticsSummaryRes.ok) throw new Error(analyticsSummaryPayload?.error || 'Analytics summary load failed.');
      if (!pathAnalyticsRes.ok) throw new Error(pathAnalyticsPayload?.error || 'Path analytics load failed.');

      setOverview(overviewPayload);
      setCourses(coursesPayload.courses || []);
      setContentPosts(contentPayload.posts || []);
      setOrganizations(organizationsPayload.organizations || []);
      setCohorts(cohortsPayload.cohorts || []);
      setAnalyticsSummary(analyticsSummaryPayload);
      setPathAnalytics(pathAnalyticsPayload.paths || []);

      const candidateCourseId = moduleForm.courseId || coursesPayload?.courses?.[0]?.id || '';
      if (candidateCourseId) {
        const modules = await loadModulesRaw(candidateCourseId, adminHeaders);
        setCourseModules(modules);
        setRubricModules(modules);
        await fetchCourseRubrics(candidateCourseId, adminHeaders);
      } else {
        setCourseModules([]);
        setRubricModules([]);
        setRubrics([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load console data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConsoleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!moduleForm.courseId) {
      setCourseModules([]);
      return;
    }

    fetchCourseModules(moduleForm.courseId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load modules.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleForm.courseId]);

  useEffect(() => {
    if (!rubricForm.courseId) {
      setRubricModules([]);
      setRubrics([]);
      return;
    }

    Promise.all([fetchCourseRubrics(rubricForm.courseId), loadModulesRaw(rubricForm.courseId)])
      .then(([, modules]) => {
        setRubricModules(modules);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load rubrics.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubricForm.courseId]);

  useEffect(() => {
    const selectedCohort = cohorts.find((cohort) => cohort.id === unlockForm.cohortId);
    const targetCourseId = selectedCohort?.course_id || '';
    if (!targetCourseId) {
      setUnlockModules([]);
      return;
    }

    loadModulesRaw(targetCourseId)
      .then((modules) => setUnlockModules(modules))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load unlock modules.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockForm.cohortId, cohorts]);

  useEffect(() => {
    if (!cohortEnrollForm.cohortId) {
      setCohortEnrollments([]);
      return;
    }

    fetchCohortEnrollments(cohortEnrollForm.cohortId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load cohort enrollments.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortEnrollForm.cohortId]);

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeRole)) {
      setActiveRole(defaultTab);
    }
  }, [activeRole, availableTabs, defaultTab]);

  const runAction = async (handler) => {
    setError('');
    setNotice('');
    try {
      const msg = await handler();
      setNotice(msg || 'Saved.');
      await loadConsoleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const createCourse = async () => {
    const response = await fetch(apiUrl('/api/admin/courses'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: courseForm.title,
        slug: courseForm.slug,
        price_cents: parseMoneyToCents(courseForm.price),
        start_date: courseForm.startDate,
        end_date: courseForm.endDate,
        status: 'draft',
        created_by: 'coordinator'
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Create course failed.');

    setCourseForm({ title: '', slug: '', price: '', startDate: '', endDate: '' });
    return `Course created: ${payload?.course?.title || 'Untitled'}`;
  };

  const publishCourse = async (courseId, status) => {
    const response = await fetch(apiUrl(`/api/admin/courses/${courseId}/publish`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ status })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Status update failed.');
    return `Course moved to ${status}.`;
  };

  const addTeacher = async () => {
    const response = await fetch(apiUrl(`/api/admin/courses/${staffForm.courseId}/staff`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: staffForm.email,
        display_name: staffForm.displayName,
        role: 'teacher'
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Teacher assignment failed.');

    setStaffForm({ courseId: '', email: '', displayName: '' });
    return 'Teacher assigned to course.';
  };

  const enrollLearner = async () => {
    const response = await fetch(apiUrl(`/api/admin/courses/${enrollForm.courseId}/enroll`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: enrollForm.email,
        display_name: enrollForm.displayName,
        status: 'active'
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Enrollment failed.');

    setEnrollForm({ courseId: '', email: '', displayName: '' });
    return 'Learner enrolled.';
  };

  const markCompletion = async () => {
    const response = await fetch(
      apiUrl(`/api/admin/courses/${completeForm.courseId}/enroll/${encodeURIComponent(completeForm.userId)}/complete`),
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ certificate_url: completeForm.certificateUrl })
      }
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Completion update failed.');

    setCompleteForm({ courseId: '', userId: '', certificateUrl: '' });
    return 'Learner marked completed.';
  };

  const createOrganization = async () => {
    const response = await fetch(apiUrl('/api/admin/organizations'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        slug: organizationForm.slug,
        name: organizationForm.name,
        brand_primary_color: organizationForm.color,
        logo_url: organizationForm.logoUrl
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Organization creation failed.');
    setOrganizationForm({ slug: '', name: '', color: '#0f172a', logoUrl: '' });
    return `Organization created: ${payload?.organization?.name || 'Unknown'}`;
  };

  const createModule = async () => {
    if (!moduleForm.courseId) throw new Error('Select a course for the module.');
    const response = await fetch(apiUrl(`/api/admin/courses/${moduleForm.courseId}/modules`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        path_key: moduleForm.pathKey,
        module_key: moduleForm.moduleKey,
        title: moduleForm.title,
        description: moduleForm.description,
        lab_type: moduleForm.labType,
        unlock_policy: moduleForm.unlockPolicy,
        estimated_minutes: Number(moduleForm.estimatedMinutes || 30)
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Module creation failed.');
    setModuleForm((prev) => ({
      ...prev,
      moduleKey: '',
      title: '',
      description: '',
      labType: '',
      unlockPolicy: 'cohort',
      estimatedMinutes: '30'
    }));
    await fetchCourseModules(moduleForm.courseId);
    return `Module created: ${payload?.module?.title || 'Untitled'}`;
  };

  const createCohort = async () => {
    if (!cohortForm.courseId) throw new Error('Select a course for the cohort.');
    const response = await fetch(apiUrl('/api/admin/cohorts'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        org_id: cohortForm.orgId,
        course_id: cohortForm.courseId,
        name: cohortForm.name,
        mode: cohortForm.mode,
        status: cohortForm.status,
        start_date: cohortForm.startDate,
        end_date: cohortForm.endDate,
        instructor_user_id: cohortForm.instructorUserId,
        fee_cents: parseMoneyToCents(cohortForm.fee)
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Cohort creation failed.');
    setCohortForm((prev) => ({
      ...prev,
      name: '',
      startDate: '',
      endDate: '',
      instructorUserId: '',
      fee: ''
    }));
    return `Cohort created: ${payload?.cohort?.name || 'Untitled'}`;
  };

  const unlockModuleForCohort = async () => {
    if (!unlockForm.cohortId || !unlockForm.moduleId) {
      throw new Error('Select cohort and module to unlock.');
    }
    const response = await fetch(apiUrl(`/api/admin/cohorts/${unlockForm.cohortId}/unlocks`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ module_id: unlockForm.moduleId })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Unlock failed.');
    setUnlockForm({ cohortId: '', moduleId: '' });
    return 'Module unlocked for cohort.';
  };

  const enrollLearnerInCohort = async () => {
    if (!cohortEnrollForm.cohortId) throw new Error('Select cohort to enroll learner.');
    const response = await fetch(apiUrl(`/api/admin/cohorts/${cohortEnrollForm.cohortId}/enroll`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        user_id: cohortEnrollForm.userId,
        email: cohortEnrollForm.email,
        display_name: cohortEnrollForm.displayName
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Cohort enrollment failed.');
    await fetchCohortEnrollments(cohortEnrollForm.cohortId);
    setCohortEnrollForm((prev) => ({ ...prev, email: '', displayName: '', userId: '' }));
    return 'Learner enrolled in cohort.';
  };

  const completeCohortEnrollment = async (userId) => {
    if (!cohortEnrollForm.cohortId || !userId) throw new Error('Select a cohort and learner to complete.');
    const response = await fetch(
      apiUrl(`/api/admin/cohorts/${cohortEnrollForm.cohortId}/enroll/${encodeURIComponent(userId)}/complete`),
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({})
      }
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Cohort completion update failed.');
    await fetchCohortEnrollments(cohortEnrollForm.cohortId);
    return `Learner marked completed: ${userId}`;
  };

  const saveRubric = async () => {
    if (!rubricForm.courseId || !rubricForm.moduleId || !rubricForm.title) {
      throw new Error('course, module, and rubric title are required.');
    }

    let rubricJson;
    try {
      rubricJson = JSON.parse(rubricForm.rubricJson);
    } catch {
      throw new Error('Rubric JSON is invalid.');
    }

    const endpoint = rubricForm.rubricId
      ? apiUrl(`/api/admin/rubrics/${rubricForm.rubricId}`)
      : apiUrl(`/api/admin/courses/${rubricForm.courseId}/rubrics`);
    const body = rubricForm.rubricId
      ? {
          title: rubricForm.title,
          pass_threshold: Number(rubricForm.passThreshold || 70),
          rubric: rubricJson
        }
      : {
          module_id: rubricForm.moduleId,
          title: rubricForm.title,
          pass_threshold: Number(rubricForm.passThreshold || 70),
          rubric: rubricJson
        };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Rubric save failed.');
    await fetchCourseRubrics(rubricForm.courseId);
    setRubricForm((prev) => ({
      ...prev,
      rubricId: '',
      title: '',
      moduleId: prev.rubricId ? prev.moduleId : ''
    }));
    return rubricForm.rubricId
      ? `Rubric updated: ${rubricForm.title}`
      : `Rubric created: ${payload?.rubric?.title || 'Untitled rubric'}`;
  };

  const loadRubricForEdit = (rubric) => {
    setRubricForm({
      rubricId: String(rubric?.id || ''),
      courseId: String(rubric?.course_id || ''),
      moduleId: String(rubric?.module_id || ''),
      title: String(rubric?.title || ''),
      passThreshold: String(rubric?.pass_threshold ?? 70),
      rubricJson: JSON.stringify(rubric?.rubric || {}, null, 2)
    });
  };

  const generateDailyBrief = async () => {
    const response = await fetch(apiUrl('/api/admin/content/generate-daily'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ force: false })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Daily generation failed.');

    if (payload?.generated?.skipped) {
      return payload.generated.reason || 'Draft already exists for today.';
    }

    return `Draft generated: ${payload?.generated?.title || 'Untitled brief'}`;
  };

  const setContentStatus = async (postId, status) => {
    const response = await fetch(apiUrl(`/api/admin/content/posts/${postId}/status`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ status })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Content status update failed.');
    return `Content moved to ${status}.`;
  };

  const isCoordinator = isCoordinatorUser && activeRole === 'coordinator';
  const isTeacher = isTeacherUser && activeRole === 'teacher';
  const isLearner = isLearnerUser && activeRole === 'learner';
  const isCto = isCtoUser && activeRole === 'cto';
  const canManageContent = isCoordinatorUser || isCtoUser;

  return (
    <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-5 shadow-xl backdrop-blur-sm md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Platform Console</p>
          <h2 className="text-2xl font-extrabold text-slate-900">Role-Based Operations</h2>
          <p className="mt-1 text-sm text-slate-600">Teacher, Coordinator, Learner, and CTO control surface.</p>
        </div>
        <button
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => void loadConsoleData()}
          type="button"
        >
          Refresh
        </button>
      </div>

      <div className={`mb-5 grid gap-3 ${isCoordinatorUser ? 'md:grid-cols-[1fr_16rem]' : 'md:grid-cols-1'}`}>
        <div className="flex flex-wrap gap-2">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeRole === tab.id ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => setActiveRole(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isCoordinatorUser ? (
          <input
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            type="password"
            placeholder="Admin token (optional)"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
          />
        ) : null}
      </div>

      {loading && <p className="mb-4 text-sm text-slate-500">Loading console data...</p>}
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {notice && <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {overview && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Courses" value={overview?.courses?.total ?? 0} />
          <Metric label="Live" value={overview?.courses?.live ?? 0} />
          <Metric label="Teachers" value={overview?.staffing?.teachers ?? 0} />
          <Metric label="Learners" value={overview?.learners?.total ?? 0} />
          <Metric label="Completion" value={`${overview?.learners?.completion_rate_pct ?? 0}%`} />
        </div>
      )}

      {analyticsSummary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="30d Registrations" value={analyticsSummary?.funnel?.registrations ?? 0} />
          <Metric label="30d Paid" value={analyticsSummary?.funnel?.paid ?? 0} />
          <Metric label="Paid Rate" value={`${analyticsSummary?.funnel?.paid_rate_pct ?? 0}%`} />
          <Metric label="Assignments 30d" value={analyticsSummary?.assignments?.submitted ?? 0} />
          <Metric label="Certificates 30d" value={analyticsSummary?.certificates?.issued_in_window ?? 0} />
        </div>
      )}

      {pathAnalytics.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Path Analytics (Last 30 Days)</h3>
          </div>
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Courses</th>
                <th className="px-3 py-2">Modules</th>
                <th className="px-3 py-2">Leads</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Enrollments</th>
                <th className="px-3 py-2">Completions</th>
                <th className="px-3 py-2">Avg Progress</th>
              </tr>
            </thead>
            <tbody>
              {pathAnalytics.map((row) => (
                <tr key={row.path_key} className="border-t border-slate-200 bg-white">
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.path_key}</td>
                  <td className="px-3 py-2 text-slate-700">{row.courses}</td>
                  <td className="px-3 py-2 text-slate-700">{row.modules}</td>
                  <td className="px-3 py-2 text-slate-700">{row.leads}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.paid} ({row.paid_rate_pct}%)
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.enrollments}</td>
                  <td className="px-3 py-2 text-slate-700">{row.completions}</td>
                  <td className="px-3 py-2 text-slate-700">{row.avg_progress_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCoordinator && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Create Course</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Course title"
                value={courseForm.title}
                onChange={(e) => setCourseForm((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Slug (optional)"
                value={courseForm.slug}
                onChange={(e) => setCourseForm((p) => ({ ...p, slug: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Price (USD)"
                value={courseForm.price}
                onChange={(e) => setCourseForm((p) => ({ ...p, price: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Start date (YYYY-MM-DD)"
                value={courseForm.startDate}
                onChange={(e) => setCourseForm((p) => ({ ...p, startDate: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="End date (YYYY-MM-DD)"
                value={courseForm.endDate}
                onChange={(e) => setCourseForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(createCourse)}
              type="button"
            >
              Create Draft Course
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Assign Teacher</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={staffForm.courseId}
                onChange={(e) => setStaffForm((p) => ({ ...p, courseId: e.target.value }))}
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Teacher email"
                value={staffForm.email}
                onChange={(e) => setStaffForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Display name"
                value={staffForm.displayName}
                onChange={(e) => setStaffForm((p) => ({ ...p, displayName: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(addTeacher)}
              type="button"
            >
              Add Teacher
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Enroll Learner</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={enrollForm.courseId}
                onChange={(e) => setEnrollForm((p) => ({ ...p, courseId: e.target.value }))}
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Learner email"
                value={enrollForm.email}
                onChange={(e) => setEnrollForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Display name"
                value={enrollForm.displayName}
                onChange={(e) => setEnrollForm((p) => ({ ...p, displayName: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(enrollLearner)}
              type="button"
            >
              Enroll
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Mark Completion</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={completeForm.courseId}
                onChange={(e) => setCompleteForm((p) => ({ ...p, courseId: e.target.value }))}
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Learner user_id"
                value={completeForm.userId}
                onChange={(e) => setCompleteForm((p) => ({ ...p, userId: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Certificate URL (optional)"
                value={completeForm.certificateUrl}
                onChange={(e) => setCompleteForm((p) => ({ ...p, certificateUrl: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(markCompletion)}
              type="button"
            >
              Complete + Certify
            </button>
          </div>
        </div>
      )}

      {isCoordinator && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Create Organization</h3>
            <div className="grid gap-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Org slug (example: mayo)"
                value={organizationForm.slug}
                onChange={(e) => setOrganizationForm((p) => ({ ...p, slug: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Organization name"
                value={organizationForm.name}
                onChange={(e) => setOrganizationForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Brand color (#0f172a)"
                value={organizationForm.color}
                onChange={(e) => setOrganizationForm((p) => ({ ...p, color: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Logo URL (optional)"
                value={organizationForm.logoUrl}
                onChange={(e) => setOrganizationForm((p) => ({ ...p, logoUrl: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(createOrganization)}
              type="button"
            >
              Create Organization
            </button>
            <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {organizations.map((org) => (
                <div key={org.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-500">{org.slug}</p>
                </div>
              ))}
              {organizations.length === 0 && <p className="text-xs text-slate-500">No organizations yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Create Course Module</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={moduleForm.courseId}
                onChange={(e) => setModuleForm((p) => ({ ...p, courseId: e.target.value }))}
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={moduleForm.pathKey}
                onChange={(e) => setModuleForm((p) => ({ ...p, pathKey: e.target.value }))}
              >
                <option value="productivity">Path 1: Productivity</option>
                <option value="research">Path 2: Research</option>
                <option value="entrepreneurship">Path 3: Entrepreneurship</option>
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Module key"
                value={moduleForm.moduleKey}
                onChange={(e) => setModuleForm((p) => ({ ...p, moduleKey: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Module title"
                value={moduleForm.title}
                onChange={(e) => setModuleForm((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Lab type (optional)"
                value={moduleForm.labType}
                onChange={(e) => setModuleForm((p) => ({ ...p, labType: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Estimated minutes"
                value={moduleForm.estimatedMinutes}
                onChange={(e) => setModuleForm((p) => ({ ...p, estimatedMinutes: e.target.value }))}
              />
              <textarea
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Module description"
                value={moduleForm.description}
                onChange={(e) => setModuleForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(createModule)}
              type="button"
            >
              Create Module
            </button>
            <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {courseModules.map((module) => (
                <div key={module.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{module.title}</p>
                  <p className="text-xs text-slate-500">
                    {module.path_key} · {module.module_key}
                  </p>
                </div>
              ))}
              {courseModules.length === 0 && <p className="text-xs text-slate-500">No modules for selected course.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Create Cohort</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={cohortForm.orgId}
                onChange={(e) => setCohortForm((p) => ({ ...p, orgId: e.target.value }))}
              >
                <option value="">Organization (optional)</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={cohortForm.courseId}
                onChange={(e) => setCohortForm((p) => ({ ...p, courseId: e.target.value }))}
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Cohort name"
                value={cohortForm.name}
                onChange={(e) => setCohortForm((p) => ({ ...p, name: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={cohortForm.mode}
                onChange={(e) => setCohortForm((p) => ({ ...p, mode: e.target.value }))}
              >
                <option value="instructor-led">Instructor-led</option>
                <option value="self-paced">Self-paced</option>
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={cohortForm.status}
                onChange={(e) => setCohortForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Start date (YYYY-MM-DD)"
                value={cohortForm.startDate}
                onChange={(e) => setCohortForm((p) => ({ ...p, startDate: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="End date (YYYY-MM-DD)"
                value={cohortForm.endDate}
                onChange={(e) => setCohortForm((p) => ({ ...p, endDate: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Instructor user_id"
                value={cohortForm.instructorUserId}
                onChange={(e) => setCohortForm((p) => ({ ...p, instructorUserId: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Fee (USD)"
                value={cohortForm.fee}
                onChange={(e) => setCohortForm((p) => ({ ...p, fee: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(createCohort)}
              type="button"
            >
              Create Cohort
            </button>
            <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {cohorts.map((cohort) => (
                <div key={cohort.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{cohort.name}</p>
                  <p className="text-xs text-slate-500">{cohort.mode} · {cohort.status}</p>
                </div>
              ))}
              {cohorts.length === 0 && <p className="text-xs text-slate-500">No cohorts yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Unlock Module In Cohort</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={unlockForm.cohortId}
                onChange={(e) => setUnlockForm((p) => ({ ...p, cohortId: e.target.value, moduleId: '' }))}
              >
                <option value="">Select cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={unlockForm.moduleId}
                onChange={(e) => setUnlockForm((p) => ({ ...p, moduleId: e.target.value }))}
              >
                <option value="">Select module</option>
                {unlockModules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(unlockModuleForCohort)}
              type="button"
            >
              Unlock Module
            </button>
            <p className="mt-3 text-xs text-slate-500">For instructor-led cohorts, this controls staged release by module.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Enroll Learner In Cohort</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={cohortEnrollForm.cohortId}
                onChange={(e) => setCohortEnrollForm((p) => ({ ...p, cohortId: e.target.value }))}
              >
                <option value="">Select cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Learner user_id (optional)"
                value={cohortEnrollForm.userId}
                onChange={(e) => setCohortEnrollForm((p) => ({ ...p, userId: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Learner email"
                value={cohortEnrollForm.email}
                onChange={(e) => setCohortEnrollForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Display name"
                value={cohortEnrollForm.displayName}
                onChange={(e) => setCohortEnrollForm((p) => ({ ...p, displayName: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(enrollLearnerInCohort)}
              type="button"
            >
              Enroll In Cohort
            </button>
            <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {cohortEnrollments.map((row) => (
                <div key={`${row.cohort_id}:${row.user_id}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{row.display_name || row.user_id}</p>
                      <p className="text-xs text-slate-500">{row.email || row.user_id}</p>
                      <p className="text-xs text-slate-500">
                        {row.status} · {Number.isFinite(Number(row.progress_pct)) ? `${row.progress_pct}%` : '0%'}
                      </p>
                    </div>
                    {row.status !== 'completed' ? (
                      <button
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => void runAction(() => completeCohortEnrollment(row.user_id))}
                        type="button"
                      >
                        Mark Completed
                      </button>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Completed</span>
                    )}
                  </div>
                </div>
              ))}
              {cohortEnrollments.length === 0 && <p className="text-xs text-slate-500">No enrollments for selected cohort.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900">Assignment Rubrics</h3>
              {rubricForm.rubricId ? (
                <button
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    setRubricForm((prev) => ({
                      ...prev,
                      rubricId: '',
                      title: '',
                      passThreshold: '70',
                      rubricJson:
                        '{\n  "criteria": [\n    "Clinical clarity",\n    "Methodological correctness",\n    "Evidence-backed reasoning"\n  ]\n}'
                    }))
                  }
                  type="button"
                >
                  Clear Edit
                </button>
              ) : null}
            </div>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={rubricForm.courseId}
                onChange={(e) =>
                  setRubricForm((p) => ({ ...p, courseId: e.target.value, moduleId: '', rubricId: '' }))
                }
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={rubricForm.moduleId}
                onChange={(e) => setRubricForm((p) => ({ ...p, moduleId: e.target.value }))}
              >
                <option value="">Select module</option>
                {rubricModules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Rubric title"
                value={rubricForm.title}
                onChange={(e) => setRubricForm((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Pass threshold (0-100)"
                value={rubricForm.passThreshold}
                onChange={(e) => setRubricForm((p) => ({ ...p, passThreshold: e.target.value }))}
              />
              <textarea
                className="min-h-[8rem] rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                value={rubricForm.rubricJson}
                onChange={(e) => setRubricForm((p) => ({ ...p, rubricJson: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(saveRubric)}
              type="button"
            >
              {rubricForm.rubricId ? 'Update Rubric' : 'Create Rubric'}
            </button>
            <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {rubrics.map((rubric) => (
                <div key={rubric.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{rubric.title}</p>
                      <p className="text-xs text-slate-500">
                        module: {rubric.module_id} · pass: {rubric.pass_threshold}
                      </p>
                    </div>
                    <button
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => loadRubricForEdit(rubric)}
                      type="button"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
              {rubrics.length === 0 && <p className="text-xs text-slate-500">No rubrics for selected course.</p>}
            </div>
          </div>
        </div>
      )}

      {isTeacher && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Teacher Studio</h3>
          <p className="mb-3 text-sm text-slate-600">
            Course planning, module authoring, assignments, and session delivery flow starts from published or live courses.
          </p>
          <div className="space-y-2">
            {courses.map((course) => (
              <div key={course.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="font-semibold text-slate-900">{course.title}</p>
                <p className="text-xs text-slate-500">Status: {course.status}</p>
              </div>
            ))}
            {courses.length === 0 && <p className="text-sm text-slate-500">No courses yet. Coordinator creates first draft.</p>}
          </div>
        </div>
      )}

      {isLearner && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Learner Journey</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              'Discover course landing',
              'Talk to AI Counselor',
              'Register and pay',
              'Access pre-read materials',
              'Use course-specific AI Tutor',
              'Submit assignments',
              'Complete course milestones',
              'Receive certificate'
            ].map((step) => (
              <p key={step} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {step}
              </p>
            ))}
          </div>
        </div>
      )}

      {isCto && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-bold text-slate-900">CTO Controls</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              'Manage provider secrets (Groq, Turnstile, payments)',
              'Rotate keys and enforce admin token for /api/admin/*',
              'Configure AI Gateway route and model defaults',
              'Audit edge analytics and D1 growth metrics',
              'Manage teacher/coordinator access policy',
              'Set compliance and certificate storage policy'
            ].map((item) => (
              <p key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {item}
              </p>
            ))}
          </div>
        </div>
      )}

      {canManageContent && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Daily Content Pipeline</h3>
              <p className="text-sm text-slate-600">Generate one draft/day, review in console, then publish to live feed cards.</p>
            </div>
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(generateDailyBrief)}
              type="button"
            >
              Generate Today&apos;s Draft
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contentPosts.map((post) => (
                  <tr key={post.id} className="border-t border-slate-200 bg-white">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-900">{post.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{post.summary}</p>
                    </td>
                    <td className="px-3 py-2 text-xs uppercase tracking-[0.1em] text-slate-600">{post.path || '-'}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{post.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatMs(post.updated_at_ms)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                          onClick={() => void runAction(() => setContentStatus(post.id, 'approved'))}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                          onClick={() => void runAction(() => setContentStatus(post.id, 'published'))}
                          type="button"
                        >
                          Publish
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                          onClick={() => void runAction(() => setContentStatus(post.id, 'rejected'))}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contentPosts.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-slate-500" colSpan={5}>
                      No content drafts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Teachers</th>
              <th className="px-3 py-2">Learners</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-t border-slate-200 bg-white">
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{course.title}</p>
                  <p className="text-xs text-slate-500">{course.slug}</p>
                </td>
                <td className="px-3 py-2 text-slate-700">{course.status}</td>
                <td className="px-3 py-2 text-slate-700">{course.teacher_count}</td>
                <td className="px-3 py-2 text-slate-700">
                  {course.learner_count} / {course.completed_count} completed
                </td>
                <td className="px-3 py-2">
                  {isCoordinatorUser ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                        onClick={() => void runAction(() => publishCourse(course.id, 'published'))}
                        type="button"
                      >
                        Publish
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                        onClick={() => void runAction(() => publishCourse(course.id, 'live'))}
                        type="button"
                      >
                        Go Live
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">View only</span>
                  )}
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-sm text-slate-500" colSpan={5}>
                  No courses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
    </article>
  );
}

function formatMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(ms));
}
