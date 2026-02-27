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

  const loadConsoleData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, coursesRes] = await Promise.all([
        fetch(apiUrl('/api/admin/overview'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/courses'), { headers: adminHeaders })
      ]);

      const overviewPayload = await overviewRes.json();
      const coursesPayload = await coursesRes.json();

      if (!overviewRes.ok) throw new Error(overviewPayload?.error || 'Overview load failed.');
      if (!coursesRes.ok) throw new Error(coursesPayload?.error || 'Courses load failed.');

      setOverview(overviewPayload);
      setCourses(coursesPayload.courses || []);
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

  const isCoordinator = isCoordinatorUser && activeRole === 'coordinator';
  const isTeacher = isTeacherUser && activeRole === 'teacher';
  const isLearner = isLearnerUser && activeRole === 'learner';
  const isCto = isCtoUser && activeRole === 'cto';

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
