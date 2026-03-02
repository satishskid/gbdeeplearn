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

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateTimeToMs(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export default function PlatformConsole({ userRoles = [], currentUser = null }) {
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
  const [opsAlerts, setOpsAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingLabRuns, setLoadingLabRuns] = useState(false);
  const [loadingCapstones, setLoadingCapstones] = useState(false);
  const [loadingLabTrends, setLoadingLabTrends] = useState(false);
  const [loadingCapstoneTrends, setLoadingCapstoneTrends] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coordinatorView, setCoordinatorView] = useState('operations');
  const [labRuns, setLabRuns] = useState([]);
  const [capstoneArtifacts, setCapstoneArtifacts] = useState([]);
  const [labTrendSeries, setLabTrendSeries] = useState([]);
  const [capstoneTrendSeries, setCapstoneTrendSeries] = useState({
    submitted: [],
    reviewed: [],
    accepted: []
  });
  const [labTrendDays, setLabTrendDays] = useState('30');
  const [capstoneTrendDays, setCapstoneTrendDays] = useState('30');
  const [loadingSessions, setLoadingSessions] = useState(false);

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
  const [sessionCohortId, setSessionCohortId] = useState('');
  const [cohortSessions, setCohortSessions] = useState([]);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    meetingUrl: '',
    recordingUrl: '',
    status: 'scheduled',
    resourcesJson: '{\n  "slides": "",\n  "prep": ""\n}'
  });
  const [attendanceForm, setAttendanceForm] = useState({
    sessionId: '',
    userId: '',
    status: 'present',
    notes: '',
    email: '',
    displayName: ''
  });

  const [rubricForm, setRubricForm] = useState({
    rubricId: '',
    courseId: '',
    moduleId: '',
    title: '',
    passThreshold: '70',
    rubricJson: '{\n  "criteria": [\n    "Clinical clarity",\n    "Methodological correctness",\n    "Evidence-backed reasoning"\n  ]\n}'
  });

  const [labOpsForm, setLabOpsForm] = useState({
    targetUserId: '',
    courseId: '',
    moduleId: '',
    cohortId: '',
    pathKey: 'research',
    toolType: 'literature-scan',
    provider: 'byok',
    modelName: '',
    input: ''
  });

  const [capstoneFilter, setCapstoneFilter] = useState({
    userId: '',
    courseId: '',
    status: ''
  });

  const [capstoneReviewForm, setCapstoneReviewForm] = useState({
    artifactId: '',
    status: 'reviewed',
    score: '',
    passed: 'auto',
    feedback: ''
  });

  const roleSet = useMemo(() => new Set((userRoles || []).map((role) => String(role).trim().toLowerCase())), [userRoles]);
  const isCtoUser = roleSet.has('cto');
  const isCoordinatorUser = isCtoUser || roleSet.has('coordinator');
  const isTeacherUser = roleSet.has('teacher');
  const isLearnerUser = isCoordinatorUser || isTeacherUser || roleSet.has('learner');

  const availableTabs = useMemo(() => {
    return ROLE_TABS.filter((tab) => {
      if (tab.id === 'coordinator') return isCoordinatorUser;
      if (tab.id === 'cto') return isCtoUser;
      if (tab.id === 'teacher') return isTeacherUser || isCoordinatorUser;
      if (tab.id === 'learner') return isLearnerUser || isCoordinatorUser;
      return false;
    });
  }, [isCoordinatorUser, isCtoUser, isTeacherUser, isLearnerUser]);

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

  const buildActorHeaders = async () => {
    const headers = {};
    if (currentUser?.uid) {
      headers['x-user-id'] = currentUser.uid;
    }
    const normalizedRoles = (userRoles || []).map((role) => String(role).trim().toLowerCase()).filter(Boolean);
    if (normalizedRoles.length > 0) {
      headers['x-user-roles'] = normalizedRoles.join(',');
    }
    if (adminToken.trim()) {
      headers['x-admin-token'] = adminToken.trim();
    }

    if (currentUser?.getIdToken) {
      try {
        const idToken = await currentUser.getIdToken();
        if (idToken) {
          headers.Authorization = `Bearer ${idToken}`;
          headers['x-firebase-id-token'] = idToken;
        }
      } catch {
        // Let API enforce auth and return explicit error if token fetch fails.
      }
    }

    return headers;
  };

  const actorFetch = async (input, init = {}) => {
    const identityHeaders = await buildActorHeaders();
    return fetch(input, {
      ...init,
      headers: {
        ...identityHeaders,
        ...(init.headers || {})
      }
    });
  };

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

  const fetchCohortSessions = async (cohortId, headers = adminHeaders) => {
    if (!cohortId) {
      setCohortSessions([]);
      setAttendanceForm((prev) => ({ ...prev, sessionId: '' }));
      return;
    }

    setLoadingSessions(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/cohorts/${cohortId}/sessions?limit=120`), { headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Session load failed.');
      const sessions = payload.sessions || [];
      setCohortSessions(sessions);
      setAttendanceForm((prev) => {
        if (prev.sessionId && sessions.some((session) => session.id === prev.sessionId)) {
          return prev;
        }
        return { ...prev, sessionId: sessions[0]?.id || '' };
      });
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadConsoleData = async () => {
    if (!adminToken.trim()) {
      setOverview(null);
      setCourses([]);
      setContentPosts([]);
      setOrganizations([]);
      setCohorts([]);
      setAnalyticsSummary(null);
      setPathAnalytics([]);
      setOpsAlerts([]);
      setCourseModules([]);
      setRubricModules([]);
      setUnlockModules([]);
      setRubrics([]);
      setCohortEnrollments([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [overviewRes, coursesRes, contentRes, organizationsRes, cohortsRes, analyticsSummaryRes, pathAnalyticsRes, alertsRes] = await Promise.all([
        fetch(apiUrl('/api/admin/overview'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/courses'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/content/posts?limit=20'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/organizations?limit=50'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/cohorts?limit=50'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/analytics/summary?days=30'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/analytics/paths?days=30'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/alerts?status=open&limit=20'), { headers: adminHeaders })
      ]);

      const overviewPayload = await overviewRes.json();
      const coursesPayload = await coursesRes.json();
      const contentPayload = await contentRes.json();
      const organizationsPayload = await organizationsRes.json();
      const cohortsPayload = await cohortsRes.json();
      const analyticsSummaryPayload = await analyticsSummaryRes.json();
      const pathAnalyticsPayload = await pathAnalyticsRes.json();
      const alertsPayload = await alertsRes.json();

      if (!overviewRes.ok) throw new Error(overviewPayload?.error || 'Overview load failed.');
      if (!coursesRes.ok) throw new Error(coursesPayload?.error || 'Courses load failed.');
      if (!contentRes.ok) throw new Error(contentPayload?.error || 'Content load failed.');
      if (!organizationsRes.ok) throw new Error(organizationsPayload?.error || 'Organizations load failed.');
      if (!cohortsRes.ok) throw new Error(cohortsPayload?.error || 'Cohorts load failed.');
      if (!analyticsSummaryRes.ok) throw new Error(analyticsSummaryPayload?.error || 'Analytics summary load failed.');
      if (!pathAnalyticsRes.ok) throw new Error(pathAnalyticsPayload?.error || 'Path analytics load failed.');
      if (!alertsRes.ok) throw new Error(alertsPayload?.error || 'Alert load failed.');

      setOverview(overviewPayload);
      setCourses(coursesPayload.courses || []);
      setContentPosts(contentPayload.posts || []);
      setOrganizations(organizationsPayload.organizations || []);
      setCohorts(cohortsPayload.cohorts || []);
      setAnalyticsSummary(analyticsSummaryPayload);
      setPathAnalytics(pathAnalyticsPayload.paths || []);
      setOpsAlerts(alertsPayload.alerts || []);

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
    if (!cohorts.length) {
      setSessionCohortId('');
      setCohortSessions([]);
      return;
    }

    if (sessionCohortId && cohorts.some((cohort) => cohort.id === sessionCohortId)) {
      return;
    }
    setSessionCohortId(cohorts[0].id);
  }, [cohorts, sessionCohortId]);

  useEffect(() => {
    if (!sessionCohortId) {
      setCohortSessions([]);
      setAttendanceForm((prev) => ({ ...prev, sessionId: '' }));
      return;
    }

    fetchCohortSessions(sessionCohortId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load sessions.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCohortId]);

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

  const createCohortSession = async () => {
    if (!sessionCohortId) throw new Error('Select a cohort first.');
    const startsAtMs = parseDateTimeToMs(sessionForm.startsAt);
    const endsAtMs = parseDateTimeToMs(sessionForm.endsAt);
    if (!sessionForm.title.trim() || !Number.isFinite(startsAtMs)) {
      throw new Error('Session title and start date-time are required.');
    }

    let resources = {};
    if (sessionForm.resourcesJson.trim()) {
      try {
        const parsed = JSON.parse(sessionForm.resourcesJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          resources = parsed;
        } else {
          throw new Error('Resources must be a JSON object.');
        }
      } catch {
        throw new Error('Resources JSON is invalid.');
      }
    }

    const response = await fetch(apiUrl(`/api/admin/cohorts/${sessionCohortId}/sessions`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: sessionForm.title,
        description: sessionForm.description,
        starts_at_ms: startsAtMs,
        ends_at_ms: Number.isFinite(endsAtMs) ? endsAtMs : null,
        meeting_url: sessionForm.meetingUrl,
        recording_url: sessionForm.recordingUrl,
        status: sessionForm.status,
        resources
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Session creation failed.');

    await fetchCohortSessions(sessionCohortId);
    setSessionForm((prev) => ({
      ...prev,
      title: '',
      description: '',
      startsAt: '',
      endsAt: '',
      meetingUrl: '',
      recordingUrl: '',
      status: 'scheduled'
    }));
    return `Session created: ${payload?.session?.title || 'Untitled session'}`;
  };

  const saveSessionAttendance = async () => {
    if (!attendanceForm.sessionId || !attendanceForm.userId.trim()) {
      throw new Error('Session and learner user_id are required.');
    }

    const response = await fetch(apiUrl(`/api/admin/sessions/${attendanceForm.sessionId}/attendance`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        user_id: attendanceForm.userId.trim(),
        status: attendanceForm.status,
        notes: attendanceForm.notes,
        email: attendanceForm.email,
        display_name: attendanceForm.displayName
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Attendance update failed.');
    await fetchCohortSessions(sessionCohortId);
    setAttendanceForm((prev) => ({
      ...prev,
      userId: '',
      notes: '',
      email: '',
      displayName: ''
    }));
    return `Attendance marked: ${payload?.status || attendanceForm.status}`;
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

  const loadLabTrends = async () => {
    setLoadingLabTrends(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(Math.max(1, Math.min(90, Number(labTrendDays || 30)))));
      if (labOpsForm.courseId.trim()) params.set('course_id', labOpsForm.courseId.trim());
      if (labOpsForm.pathKey.trim()) params.set('path_key', labOpsForm.pathKey.trim());
      if (labOpsForm.targetUserId.trim()) params.set('user_id', labOpsForm.targetUserId.trim());

      const response = await fetch(apiUrl(`/api/admin/analytics/learning-trends?${params.toString()}`), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Lab trend load failed.');
      setLabTrendSeries(payload?.lab_runs || []);
      return `Lab trends loaded (${payload?.days || labTrendDays}d).`;
    } finally {
      setLoadingLabTrends(false);
    }
  };

  const loadCapstoneTrends = async () => {
    setLoadingCapstoneTrends(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(Math.max(1, Math.min(90, Number(capstoneTrendDays || 30)))));
      if (capstoneFilter.courseId.trim()) params.set('course_id', capstoneFilter.courseId.trim());
      if (capstoneFilter.userId.trim()) params.set('user_id', capstoneFilter.userId.trim());
      if (capstoneFilter.status.trim()) params.set('status', capstoneFilter.status.trim());

      const response = await fetch(apiUrl(`/api/admin/analytics/learning-trends?${params.toString()}`), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Capstone trend load failed.');
      setCapstoneTrendSeries({
        submitted: payload?.capstones_submitted || [],
        reviewed: payload?.capstones_reviewed || [],
        accepted: payload?.capstones_accepted || []
      });
      return `Capstone trends loaded (${payload?.days || capstoneTrendDays}d).`;
    } finally {
      setLoadingCapstoneTrends(false);
    }
  };

  const ingestLogisticsContext = async () => {
    const response = await fetch(apiUrl('/api/admin/knowledge/ingest-logistics'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Logistics ingestion failed.');
    return `Counselor logistics ingested (${payload?.upserted || 0} vectors).`;
  };

  const loadOpsAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const response = await fetch(apiUrl('/api/admin/alerts?status=open&limit=40'), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Alert load failed.');
      setOpsAlerts(payload?.alerts || []);
      return `Loaded ${Number(payload?.alerts?.length || 0)} open alerts.`;
    } finally {
      setLoadingAlerts(false);
    }
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

  const runLabExperiment = async () => {
    const targetUserId = String(labOpsForm.targetUserId || '').trim();
    if (!targetUserId || !labOpsForm.courseId || !labOpsForm.moduleId || !labOpsForm.input.trim()) {
      throw new Error('target user, course, module, and input are required.');
    }

    const response = await actorFetch(apiUrl('/api/lab/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: targetUserId,
        course_id: labOpsForm.courseId,
        module_id: labOpsForm.moduleId,
        cohort_id: labOpsForm.cohortId,
        path_key: labOpsForm.pathKey,
        tool_type: labOpsForm.toolType,
        provider: labOpsForm.provider,
        model_name: labOpsForm.modelName,
        input: labOpsForm.input
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Lab experiment failed.');

    const run = payload?.run || null;
    if (run) {
      setLabRuns((current) => [run, ...(current || [])].slice(0, 30));
    }
    return `Lab run completed${run?.id ? ` (${run.id})` : ''}.`;
  };

  const loadLabExperimentRuns = async () => {
    const targetUserId = String(labOpsForm.targetUserId || '').trim();
    if (!targetUserId) {
      throw new Error('target user_id is required to load lab runs.');
    }

    setLoadingLabRuns(true);
    try {
      const params = new URLSearchParams();
      params.set('user_id', targetUserId);
      params.set('limit', '30');
      if (labOpsForm.courseId) params.set('course_id', labOpsForm.courseId);
      if (labOpsForm.moduleId) params.set('module_id', labOpsForm.moduleId);
      if (labOpsForm.pathKey) params.set('path_key', labOpsForm.pathKey);

      const response = await actorFetch(apiUrl(`/api/lab/runs?${params.toString()}`));
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Lab runs load failed.');
      setLabRuns(payload?.runs || []);
      await loadLabTrends();
      return 'Lab runs loaded.';
    } finally {
      setLoadingLabRuns(false);
    }
  };

  const loadCapstoneArtifacts = async () => {
    setLoadingCapstones(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '40');
      if (capstoneFilter.userId.trim()) params.set('user_id', capstoneFilter.userId.trim());
      if (capstoneFilter.courseId.trim()) params.set('course_id', capstoneFilter.courseId.trim());
      if (capstoneFilter.status.trim()) params.set('status', capstoneFilter.status.trim());

      const response = await actorFetch(apiUrl(`/api/learn/capstone/artifacts?${params.toString()}`));
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Capstone list failed.');
      setCapstoneArtifacts(payload?.artifacts || []);
      await loadCapstoneTrends();
      return 'Capstone artifacts loaded.';
    } finally {
      setLoadingCapstones(false);
    }
  };

  const submitCapstoneReview = async () => {
    const artifactId = capstoneReviewForm.artifactId.trim();
    if (!artifactId) throw new Error('artifactId is required.');

    const body = {
      status: capstoneReviewForm.status,
      feedback: capstoneReviewForm.feedback
    };

    const score = toNumberOrNull(capstoneReviewForm.score);
    if (score !== null) body.score = score;
    if (capstoneReviewForm.passed === 'true') body.passed = true;
    if (capstoneReviewForm.passed === 'false') body.passed = false;

    const response = await actorFetch(apiUrl(`/api/learn/capstone/${encodeURIComponent(artifactId)}/review`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Capstone review failed.');

    const status = payload?.review?.status || capstoneReviewForm.status;
    await loadCapstoneArtifacts();
    return `Capstone reviewed (${status}).`;
  };

  const isCoordinator = isCoordinatorUser && activeRole === 'coordinator';
  const isTeacher = isTeacherUser && activeRole === 'teacher';
  const isLearner = isLearnerUser && activeRole === 'learner';
  const isCto = isCtoUser && activeRole === 'cto';
  const hasAdminToken = Boolean(adminToken.trim());
  const canManageContent = (isCoordinatorUser || isCtoUser) && hasAdminToken;

  const labMetrics = useMemo(() => {
    const totalRuns = labRuns.length;
    const uniqueLearners = new Set(labRuns.map((run) => String(run.user_id || '')).filter(Boolean)).size;
    const latencyValues = labRuns.map((run) => Number(run.latency_ms)).filter((value) => Number.isFinite(value) && value >= 0);
    const avgLatencyMs =
      latencyValues.length > 0
        ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
        : 0;
    const pathCounts = labRuns.reduce(
      (acc, run) => {
        const path = String(run.path_key || '').toLowerCase();
        if (path === 'productivity') acc.productivity += 1;
        else if (path === 'entrepreneurship') acc.entrepreneurship += 1;
        else acc.research += 1;
        return acc;
      },
      { productivity: 0, research: 0, entrepreneurship: 0 }
    );

    return {
      totalRuns,
      uniqueLearners,
      avgLatencyMs,
      pathCounts
    };
  }, [labRuns]);

  const capstoneMetrics = useMemo(() => {
    const totalArtifacts = capstoneArtifacts.length;
    const acceptedCount = capstoneArtifacts.filter((artifact) => {
      if (String(artifact.status || '').toLowerCase() === 'accepted') return true;
      return artifact?.feedback?.passed === true;
    }).length;
    const pendingCount = capstoneArtifacts.filter((artifact) =>
      ['submitted', 'needs_revision'].includes(String(artifact.status || '').toLowerCase())
    ).length;
    const scoredValues = capstoneArtifacts
      .map((artifact) => Number(artifact.score))
      .filter((value) => Number.isFinite(value));
    const avgScore = scoredValues.length > 0 ? Math.round(scoredValues.reduce((sum, value) => sum + value, 0) / scoredValues.length) : 0;
    const acceptanceRatePct = totalArtifacts > 0 ? Number(((acceptedCount / totalArtifacts) * 100).toFixed(1)) : 0;

    return {
      totalArtifacts,
      acceptedCount,
      pendingCount,
      avgScore,
      acceptanceRatePct
    };
  }, [capstoneArtifacts]);

  const labTrendMetrics = useMemo(() => {
    const runPoints = labTrendSeries.map((point) => Number(point.count || 0));
    const latencyPoints = labTrendSeries.map((point) => Number(point.avg_latency_ms || 0));
    const learnerPoints = labTrendSeries.map((point) => Number(point.unique_learners || 0));
    return {
      runPoints,
      latencyPoints,
      learnerPoints,
      totalRuns: runPoints.reduce((sum, value) => sum + value, 0),
      totalLearnerTouches: learnerPoints.reduce((sum, value) => sum + value, 0)
    };
  }, [labTrendSeries]);

  const capstoneTrendMetrics = useMemo(() => {
    const submittedPoints = (capstoneTrendSeries.submitted || []).map((point) => Number(point.count || 0));
    const reviewedPoints = (capstoneTrendSeries.reviewed || []).map((point) => Number(point.count || 0));
    const acceptedPoints = (capstoneTrendSeries.accepted || []).map((point) => Number(point.count || 0));
    const submittedTotal = submittedPoints.reduce((sum, value) => sum + value, 0);
    const reviewedTotal = reviewedPoints.reduce((sum, value) => sum + value, 0);
    const acceptedTotal = acceptedPoints.reduce((sum, value) => sum + value, 0);
    return {
      submittedPoints,
      reviewedPoints,
      acceptedPoints,
      submittedTotal,
      reviewedTotal,
      acceptedTotal,
      acceptanceRatePct: submittedTotal > 0 ? Number(((acceptedTotal / submittedTotal) * 100).toFixed(1)) : 0
    };
  }, [capstoneTrendSeries]);

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
      {!hasAdminToken ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Enter your admin token to unlock coordinator/CTO data and controls.
        </p>
      ) : null}

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

      {isCoordinator && hasAdminToken && (
        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          {[
            { id: 'operations', label: 'Operations' },
            { id: 'lab-ops', label: 'Lab Ops' },
            { id: 'capstone-review', label: 'Capstone Review' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                coordinatorView === tab.id ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => setCoordinatorView(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {isCoordinator && hasAdminToken && coordinatorView === 'operations' && (
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

      {isCoordinator && hasAdminToken && coordinatorView === 'operations' && (
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
            <h3 className="mb-3 text-lg font-bold text-slate-900">Session Planner + Attendance</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={sessionCohortId}
                onChange={(e) => setSessionCohortId(e.target.value)}
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
                placeholder="Session title"
                value={sessionForm.title}
                onChange={(e) => setSessionForm((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Session description (optional)"
                value={sessionForm.description}
                onChange={(e) => setSessionForm((p) => ({ ...p, description: e.target.value }))}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  type="datetime-local"
                  value={sessionForm.startsAt}
                  onChange={(e) => setSessionForm((p) => ({ ...p, startsAt: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  type="datetime-local"
                  value={sessionForm.endsAt}
                  onChange={(e) => setSessionForm((p) => ({ ...p, endsAt: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Meeting URL"
                  value={sessionForm.meetingUrl}
                  onChange={(e) => setSessionForm((p) => ({ ...p, meetingUrl: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Recording URL"
                  value={sessionForm.recordingUrl}
                  onChange={(e) => setSessionForm((p) => ({ ...p, recordingUrl: e.target.value }))}
                />
              </div>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={sessionForm.status}
                onChange={(e) => setSessionForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <textarea
                className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                placeholder='Resources JSON (example: {"slides":"https://...","prep":"https://..."})'
                value={sessionForm.resourcesJson}
                onChange={(e) => setSessionForm((p) => ({ ...p, resourcesJson: e.target.value }))}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void runAction(createCohortSession)}
                type="button"
              >
                Create Session
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(() => fetchCohortSessions(sessionCohortId))}
                type="button"
                disabled={loadingSessions || !sessionCohortId}
              >
                {loadingSessions ? 'Loading...' : 'Refresh Sessions'}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-900">Attendance Update</p>
              <div className="grid gap-2">
                <select
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={attendanceForm.sessionId}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, sessionId: e.target.value }))}
                >
                  <option value="">Select session</option>
                  {cohortSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title} ({formatMs(session.starts_at_ms)})
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Learner user_id"
                  value={attendanceForm.userId}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, userId: e.target.value }))}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Learner email (optional)"
                    value={attendanceForm.email}
                    onChange={(e) => setAttendanceForm((p) => ({ ...p, email: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Display name (optional)"
                    value={attendanceForm.displayName}
                    onChange={(e) => setAttendanceForm((p) => ({ ...p, displayName: e.target.value }))}
                  />
                </div>
                <select
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={attendanceForm.status}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
                <textarea
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Attendance notes (optional)"
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <button
                className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(saveSessionAttendance)}
                type="button"
              >
                Save Attendance
              </button>
            </div>

            <div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {cohortSessions.map((session) => (
                <div key={session.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatMs(session.starts_at_ms)} · {session.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    Attendance: {session.attendance_present || 0}/{session.attendance_total || 0}
                  </p>
                  {session.meeting_url ? (
                    <a className="text-xs font-semibold text-cyan-700 hover:underline" href={session.meeting_url} target="_blank" rel="noreferrer">
                      Meeting link
                    </a>
                  ) : null}
                </div>
              ))}
              {cohortSessions.length === 0 && <p className="text-xs text-slate-500">No sessions for selected cohort.</p>}
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

      {isCoordinator && hasAdminToken && coordinatorView === 'lab-ops' && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Lab Operations Console</h3>
            <p className="mb-3 text-sm text-slate-600">Run supervised lab experiments and inspect run history per learner.</p>
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Runs Loaded" value={labMetrics.totalRuns} />
              <Metric label="Learners In Scope" value={labMetrics.uniqueLearners} />
              <Metric label="Avg Latency (ms)" value={labMetrics.avgLatencyMs} />
              <Metric
                label="Path Mix"
                value={`${labMetrics.pathCounts.productivity}/${labMetrics.pathCounts.research}/${labMetrics.pathCounts.entrepreneurship}`}
              />
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Scope uses current user/course/module filters. Path mix order: productivity / research / entrepreneurship.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={labTrendDays}
                onChange={(e) => setLabTrendDays(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(loadLabTrends)}
                type="button"
                disabled={loadingLabTrends}
              >
                {loadingLabTrends ? 'Loading trends...' : 'Refresh Trends'}
              </button>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <TrendSparklineCard
                label={`Runs/day (${labTrendDays}d)`}
                value={labTrendMetrics.totalRuns}
                points={labTrendMetrics.runPoints}
              />
              <TrendSparklineCard
                label={`Learner touches (${labTrendDays}d)`}
                value={labTrendMetrics.totalLearnerTouches}
                points={labTrendMetrics.learnerPoints}
              />
              <TrendSparklineCard
                label={`Avg latency trend (${labTrendDays}d)`}
                value={`${labTrendMetrics.latencyPoints.at(-1) || 0} ms`}
                points={labTrendMetrics.latencyPoints}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Target learner user_id"
                value={labOpsForm.targetUserId}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, targetUserId: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={labOpsForm.courseId}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, courseId: e.target.value }))}
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
                placeholder="Module ID"
                value={labOpsForm.moduleId}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, moduleId: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Cohort ID (optional)"
                value={labOpsForm.cohortId}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, cohortId: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={labOpsForm.pathKey}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, pathKey: e.target.value }))}
              >
                <option value="productivity">Path 1: Productivity</option>
                <option value="research">Path 2: Research</option>
                <option value="entrepreneurship">Path 3: Entrepreneurship</option>
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tool type"
                value={labOpsForm.toolType}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, toolType: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Provider"
                value={labOpsForm.provider}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, provider: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Model name (optional)"
                value={labOpsForm.modelName}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, modelName: e.target.value }))}
              />
              <textarea
                className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Experiment input"
                value={labOpsForm.input}
                onChange={(e) => setLabOpsForm((p) => ({ ...p, input: e.target.value }))}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void runAction(runLabExperiment)}
                type="button"
              >
                Run Experiment
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(loadLabExperimentRuns)}
                type="button"
                disabled={loadingLabRuns}
              >
                {loadingLabRuns ? 'Loading...' : 'Load Runs'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Recent Lab Runs</h3>
            <div className="max-h-[28rem] space-y-2 overflow-auto">
              {labRuns.map((run) => (
                <div key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {run.path_key} · {run.tool_type}
                  </p>
                  <p className="text-xs text-slate-600">{run.user_id}</p>
                  <p className="text-xs text-slate-500">{run.output?.input_summary || 'No summary'}</p>
                </div>
              ))}
              {labRuns.length === 0 && <p className="text-sm text-slate-500">No lab runs loaded.</p>}
            </div>
          </div>
        </div>
      )}

      {isCoordinator && hasAdminToken && coordinatorView === 'capstone-review' && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Capstone Review Board</h3>
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Artifacts Loaded" value={capstoneMetrics.totalArtifacts} />
              <Metric label="Pending Review" value={capstoneMetrics.pendingCount} />
              <Metric label="Accepted" value={capstoneMetrics.acceptedCount} />
              <Metric label="Acceptance Rate" value={`${capstoneMetrics.acceptanceRatePct}%`} />
              <Metric label="Avg Score" value={capstoneMetrics.avgScore} />
            </div>
            <p className="mb-3 text-xs text-slate-500">Metrics are scoped to the active user/course/status filters in this board.</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={capstoneTrendDays}
                onChange={(e) => setCapstoneTrendDays(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(loadCapstoneTrends)}
                type="button"
                disabled={loadingCapstoneTrends}
              >
                {loadingCapstoneTrends ? 'Loading trends...' : 'Refresh Trends'}
              </button>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <TrendSparklineCard
                label={`Submitted/day (${capstoneTrendDays}d)`}
                value={capstoneTrendMetrics.submittedTotal}
                points={capstoneTrendMetrics.submittedPoints}
              />
              <TrendSparklineCard
                label={`Reviewed/day (${capstoneTrendDays}d)`}
                value={capstoneTrendMetrics.reviewedTotal}
                points={capstoneTrendMetrics.reviewedPoints}
              />
              <TrendSparklineCard
                label={`Accepted/day (${capstoneTrendDays}d)`}
                value={`${capstoneTrendMetrics.acceptedTotal} (${capstoneTrendMetrics.acceptanceRatePct}%)`}
                points={capstoneTrendMetrics.acceptedPoints}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Filter user_id"
                value={capstoneFilter.userId}
                onChange={(e) => setCapstoneFilter((p) => ({ ...p, userId: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Filter course_id"
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
            <button
              className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => void runAction(loadCapstoneArtifacts)}
              type="button"
              disabled={loadingCapstones}
            >
              {loadingCapstones ? 'Loading...' : 'Load Artifacts'}
            </button>

            <div className="mt-4 max-h-[28rem] space-y-2 overflow-auto">
              {capstoneArtifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{artifact.title}</p>
                      <p className="text-xs text-slate-600">
                        {artifact.user_id} · {artifact.status} · score {artifact.score ?? '-'}
                      </p>
                    </div>
                    <button
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      onClick={() =>
                        setCapstoneReviewForm((current) => ({
                          ...current,
                          artifactId: artifact.id,
                          status: artifact.status || 'reviewed',
                          score: artifact.score ?? ''
                        }))
                      }
                      type="button"
                    >
                      Select
                    </button>
                  </div>
                </div>
              ))}
              {capstoneArtifacts.length === 0 && <p className="text-sm text-slate-500">No artifacts loaded.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Submit Review</h3>
            <div className="grid gap-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Artifact ID"
                value={capstoneReviewForm.artifactId}
                onChange={(e) => setCapstoneReviewForm((p) => ({ ...p, artifactId: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={capstoneReviewForm.status}
                onChange={(e) => setCapstoneReviewForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="reviewed">Reviewed</option>
                <option value="accepted">Accepted</option>
                <option value="needs_revision">Needs revision</option>
                <option value="rejected">Rejected</option>
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Score (0-100, optional)"
                value={capstoneReviewForm.score}
                onChange={(e) => setCapstoneReviewForm((p) => ({ ...p, score: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={capstoneReviewForm.passed}
                onChange={(e) => setCapstoneReviewForm((p) => ({ ...p, passed: e.target.value }))}
              >
                <option value="auto">Passed: Auto</option>
                <option value="true">Passed: Yes</option>
                <option value="false">Passed: No</option>
              </select>
              <textarea
                className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Review feedback"
                value={capstoneReviewForm.feedback}
                onChange={(e) => setCapstoneReviewForm((p) => ({ ...p, feedback: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(submitCapstoneReview)}
              type="button"
            >
              Save Review
            </button>
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
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
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

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void runAction(ingestLogisticsContext)}
                type="button"
                disabled={!hasAdminToken}
              >
                Ingest Counselor Logistics
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void runAction(loadOpsAlerts)}
                type="button"
                disabled={!hasAdminToken || loadingAlerts}
              >
                {loadingAlerts ? 'Refreshing...' : 'Refresh Open Alerts'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Open Ops Alerts</h3>
            <div className="max-h-72 space-y-2 overflow-auto">
              {opsAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{alert.message}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                        String(alert.severity || '').toLowerCase() === 'critical'
                          ? 'bg-rose-100 text-rose-700'
                          : String(alert.severity || '').toLowerCase() === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {alert.severity || 'warning'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {alert.source} · {alert.event_type} · {formatMs(alert.created_at_ms)}
                  </p>
                </div>
              ))}
              {opsAlerts.length === 0 ? <p className="text-sm text-slate-500">No open alerts.</p> : null}
            </div>
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
                  {isCoordinatorUser && hasAdminToken ? (
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
                    <span className="text-xs text-slate-500">{isCoordinatorUser ? 'Add admin token' : 'View only'}</span>
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

function TrendSparklineCard({ label, value, points }) {
  const numericPoints = (points || []).map((point) => Number(point || 0)).filter((point) => Number.isFinite(point));
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
      <div className="mt-2 h-12 rounded-lg bg-white px-1 py-1">
        <Sparkline points={numericPoints} />
      </div>
    </article>
  );
}

function Sparkline({ points = [] }) {
  if (!points.length) {
    return <div className="flex h-full items-center text-[11px] text-slate-400">No trend data</div>;
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const denominator = points.length > 1 ? points.length - 1 : 1;
  const polyline = points
    .map((value, index) => {
      const x = (index / denominator) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="h-full w-full text-cyan-600" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
    </svg>
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
