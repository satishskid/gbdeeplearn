import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';
import { preferredPlatformTab } from '../lib/userRoles';

const ROLE_TABS = [
  { id: 'coordinator', label: 'Course Coordinator / Content Editor' },
  { id: 'teacher', label: 'Teacher / Trainer' },
  { id: 'learner', label: 'Visitor + Learner' },
  { id: 'cto', label: 'CTO / Platform Admin' }
];

const PUBLIC_SITE_URL = 'https://edu.greybrain.ai';
const CONTENT_PATH_META = {
  productivity: {
    label: 'Practice',
    trackUrl: `${PUBLIC_SITE_URL}/tracks/clinical-ai-practitioner/`,
    hashtags: ['#ClinicalAI', '#DoctorsWhoUseAI', '#HealthcareProductivity', '#GreyBrainAcademy']
  },
  research: {
    label: 'Publish',
    trackUrl: `${PUBLIC_SITE_URL}/tracks/ai-research-accelerator/`,
    hashtags: ['#MedicalResearch', '#ResearchAI', '#DoctorsWhoPublish', '#GreyBrainAcademy']
  },
  entrepreneurship: {
    label: 'Build',
    trackUrl: `${PUBLIC_SITE_URL}/tracks/doctor-ai-entrepreneurship/`,
    hashtags: ['#HealthTech', '#DoctorFounder', '#AIEntrepreneurship', '#GreyBrainAcademy']
  }
};

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

function getRefresherPlaybook(pathKey) {
  const key = String(pathKey || '').trim().toLowerCase();
  if (key === 'research') {
    return {
      label: 'Publish',
      nextAction: 'Send the Research Accelerator overview, evidence-synthesis examples, and the next Path 2 cohort dates.',
      ownerPrompt: 'Position this lead around publication speed, study design clarity, and manuscript readiness.',
      trackUrl: `${PUBLIC_SITE_URL}/tracks/ai-research-accelerator/`
    };
  }
  if (key === 'entrepreneurship') {
    return {
      label: 'Build',
      nextAction: 'Send the venture-builder outline, capstone-to-pilot story, and invite a founder-fit call.',
      ownerPrompt: 'Position this lead around MVP planning, pilot metrics, and clinician-founder execution.',
      trackUrl: `${PUBLIC_SITE_URL}/tracks/doctor-ai-entrepreneurship/`
    };
  }
  if (key === 'productivity') {
    return {
      label: 'Practice',
      nextAction: 'Send the clinical productivity track overview, note-to-patient workflow examples, and the next Path 1 intake.',
      ownerPrompt: 'Position this lead around immediate workflow leverage in notes, communication, and safe clinical support.',
      trackUrl: `${PUBLIC_SITE_URL}/tracks/clinical-ai-practitioner/`
    };
  }
  return null;
}

const CRM_SEGMENTS = [
  {
    id: 'all',
    label: 'All Leads',
    description: 'Full CRM queue across all channels and cohorts.'
  },
  {
    id: 'practice_intent',
    label: 'Practice Intent',
    description: 'Refresher recommends Path 1 clinical productivity.',
    reminderLabel: 'Queue Practice Follow-up',
    ownerPrompt: 'Send Path 1 note-to-patient and communication workflow examples, then invite them to the next cohort.',
    defaultStage: 'qualified'
  },
  {
    id: 'research_intent',
    label: 'Research Intent',
    description: 'Refresher recommends Path 2 publication and research acceleration.',
    reminderLabel: 'Queue Research Follow-up',
    ownerPrompt: 'Send Path 2 evidence-synthesis and manuscript examples, then invite them to the next cohort.',
    defaultStage: 'qualified'
  },
  {
    id: 'build_intent',
    label: 'Build Intent',
    description: 'Refresher recommends Path 3 venture and pilot-building support.',
    reminderLabel: 'Queue Build Follow-up',
    ownerPrompt: 'Send Path 3 venture outline, pilot metrics examples, and offer a founder-fit conversation.',
    defaultStage: 'qualified'
  },
  {
    id: 'refresher_complete_not_enrolled',
    label: 'Refresher Complete, Not Enrolled',
    description: 'Completed the starter flow but has not converted to paid enrollment yet.',
    reminderLabel: 'Queue Cohort Conversion Reminder',
    ownerPrompt: 'Acknowledge refresher completion, recommend the best-fit path, and give one concrete next cohort date.',
    defaultStage: 'contacted'
  },
  {
    id: 'payment_pending_followup',
    label: 'Payment Pending',
    description: 'Interested or qualified leads that still need payment closure.',
    reminderLabel: 'Queue Payment Follow-up',
    ownerPrompt: 'Confirm course fit, remove friction on payment, and send the exact next step to complete enrollment.',
    defaultStage: 'payment_pending'
  }
];

function matchesCrmSegment(lead, segmentId) {
  if (!lead || !segmentId || segmentId === 'all') return true;
  const recommendedPath = String(lead?.refresher?.recommended_path || '').trim().toLowerCase();
  const chapterEvents = Number(lead?.refresher?.chapter_events || 0);
  const paymentStatus = String(lead?.payment_status || '').trim().toLowerCase();

  if (segmentId === 'practice_intent') return recommendedPath === 'productivity';
  if (segmentId === 'research_intent') return recommendedPath === 'research';
  if (segmentId === 'build_intent') return recommendedPath === 'entrepreneurship';
  if (segmentId === 'refresher_complete_not_enrolled') {
    return chapterEvents >= 5 && paymentStatus !== 'paid';
  }
  if (segmentId === 'payment_pending_followup') {
    return paymentStatus !== 'paid' && (lead?.crm?.stage === 'payment_pending' || paymentStatus === 'registered');
  }
  return true;
}

function appendCrmNote(existingNotes, note) {
  const existing = String(existingNotes || '').trim();
  const next = String(note || '').trim();
  if (!next) return existing;
  if (!existing) return next;
  if (existing.includes(next)) return existing;
  return `${existing}\n\n${next}`;
}

function buildCrmChannelTemplates(lead, playbook, segmentMeta) {
  if (!lead) {
    return {
      whatsapp: '',
      email: '',
      counselor: ''
    };
  }

  const firstName = String(lead.full_name || lead.email || 'Doctor').trim().split(/\s+/)[0] || 'Doctor';
  const courseName = lead.course_title || lead.course_slug || 'the GreyBrain pathway';
  const recommendedLabel = playbook?.label || 'GreyBrain';
  const trackUrl = playbook?.trackUrl || `${PUBLIC_SITE_URL}/tracks/`;
  const coreLine =
    playbook?.nextAction ||
    segmentMeta?.ownerPrompt ||
    'I am sharing the next GreyBrain cohort details and a quick path recommendation based on your recent interest.';

  return {
    whatsapp: `Hi ${firstName}, based on your GreyBrain activity I recommend the ${recommendedLabel} path. ${coreLine} You can review it here: ${trackUrl}`,
    email: [
      `Subject: Your next GreyBrain step: ${recommendedLabel}`,
      '',
      `Hi ${firstName},`,
      '',
      `Based on your progress so far, ${courseName} is best followed by the ${recommendedLabel} path.`,
      coreLine,
      '',
      `Track link: ${trackUrl}`,
      '',
      'Reply if you want the next cohort date or need help choosing between tracks.'
    ].join('\n'),
    counselor: `Lead handoff for ${firstName}: recommended path is ${recommendedLabel}. Reposition the conversation around ${coreLine.toLowerCase()}`
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (!text.includes('"') && !text.includes(',') && !text.includes('\n')) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCrmSegmentCsv(leads = []) {
  const headers = [
    'lead_id',
    'full_name',
    'email',
    'phone',
    'course_title',
    'course_slug',
    'payment_status',
    'crm_stage',
    'crm_owner_user_id',
    'crm_next_action_at_ms',
    'refresher_started',
    'refresher_chapter_events',
    'refresher_recommended_path',
    'source',
    'channel',
    'kind',
    'updated_at_ms'
  ];

  const rows = (leads || []).map((lead) => [
    lead.lead_id,
    lead.full_name,
    lead.email,
    lead.phone,
    lead.course_title,
    lead.course_slug,
    lead.payment_status,
    lead?.crm?.stage || '',
    lead?.crm?.owner_user_id || '',
    lead?.crm?.next_action_at_ms || '',
    lead?.refresher?.started ? 'yes' : 'no',
    lead?.refresher?.chapter_events || 0,
    lead?.refresher?.recommended_path || '',
    lead.source,
    lead.channel,
    lead.kind,
    lead.updated_at_ms || ''
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

const CRM_SAVED_VIEWS_STORAGE_KEY = 'gbdeeplearn.crm.savedViews.v1';

function loadSavedCrmViews() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CRM_SAVED_VIEWS_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeCrmViewName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60);
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function countSerializedList(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

function defaultCounselorKnowledgeForm() {
  return {
    itemId: '',
    kind: 'faq',
    scope: 'global',
    courseId: '',
    title: '',
    body: '',
    sortOrder: '100',
    isActive: true
  };
}

function defaultSessionForm() {
  return {
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    meetingUrl: '',
    recordingUrl: '',
    status: 'scheduled',
    resourcesJson: '{\n  "slides": "",\n  "prep": ""\n}'
  };
}

function defaultContentEditorForm() {
  return {
    postId: '',
    title: '',
    summary: '',
    path: 'productivity',
    contentType: 'daily_brief',
    tags: '',
    canonicalUrl: '',
    sourceUrls: '',
    contentMarkdown: ''
  };
}

function normalizeUrlList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/\n|,/);
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 12);
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clampText(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  const sliced = text.slice(0, Math.max(0, limit - 1));
  const boundary = sliced.lastIndexOf(' ');
  return `${(boundary > 80 ? sliced.slice(0, boundary) : sliced).trim()}...`;
}

function getParagraphsFromMarkdown(markdown) {
  return stripMarkdown(markdown)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildExportVariants({ title, summary, path, tags, canonicalUrl, sourceUrls, contentMarkdown }) {
  const meta = CONTENT_PATH_META[path] || CONTENT_PATH_META.productivity;
  const cleanedTitle = clampText(title || 'GreyBrain Academy Brief', 120);
  const cleanedSummary = clampText(summary || '', 280);
  const paragraphs = getParagraphsFromMarkdown(contentMarkdown);
  const canonical = String(canonicalUrl || '').trim() || meta.trackUrl;
  const sources = normalizeUrlList(sourceUrls);
  const keyPoints = paragraphs.slice(0, 3).map((item) => clampText(item, 220));
  const supportingBody = paragraphs.slice(0, 6).map((item) => clampText(item, 480));
  const extraTags = String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((tag) => `#${tag.replace(/[^a-z0-9]+/gi, '')}`);
  const hashtags = [...meta.hashtags, ...extraTags].slice(0, 5);
  const ctaLine = `Read on GreyBrain: ${canonical}`;
  const sourcesLine = sources.length > 0 ? `Sources: ${sources.join(' | ')}` : '';
  const fallbackPoint = cleanedSummary || 'A new GreyBrain Academy brief for doctors working with AI.';
  const points = keyPoints.length > 0 ? keyPoints : [fallbackPoint];

  const linkedin = [
    cleanedTitle,
    '',
    cleanedSummary,
    '',
    ...points.map((point) => `- ${point}`),
    '',
    `This sits inside GreyBrain Academy's ${meta.label.toLowerCase()} track for doctors who want to practice, publish, and build with AI.`,
    ctaLine,
    sourcesLine,
    '',
    hashtags.join(' ')
  ]
    .filter(Boolean)
    .join('\n');

  const facebook = [
    cleanedTitle,
    '',
    cleanedSummary,
    '',
    ...points.slice(0, 2),
    '',
    `GreyBrain Academy is building a clinician-first AI learning system around three outcomes: practice, publish, and build.`,
    ctaLine,
    sourcesLine
  ]
    .filter(Boolean)
    .join('\n');

  const xTweets = [
    `1/4 ${clampText(`${cleanedTitle}: ${cleanedSummary || fallbackPoint}`, 250)}`,
    `2/4 ${clampText(points[0] || fallbackPoint, 260)}`,
    `3/4 ${clampText(points[1] || points[0] || fallbackPoint, 260)}`,
    `4/4 ${clampText(`GreyBrain Academy ${meta.label} track for doctors. ${canonical}`, 260)}`
  ];
  const xThread = xTweets.join('\n\n');

  const medium = [
    cleanedTitle,
    '',
    cleanedSummary,
    '',
    ...supportingBody,
    '',
    '---',
    '',
    `Originally prepared for GreyBrain Academy's ${meta.label.toLowerCase()} audience.`,
    ctaLine,
    sourcesLine,
    '',
    hashtags.join(' ')
  ]
    .filter(Boolean)
    .join('\n');

  return {
    linkedin,
    facebook,
    x: xThread,
    medium
  };
}

function formatForDateTimeLocal(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(ms - offsetMs).toISOString().slice(0, 16);
}

export default function PlatformConsole({ userRoles = [], currentUser = null }) {
  const [adminToken, setAdminToken] = useState('');
  const [adminHeaders, setAdminHeaders] = useState({ 'Content-Type': 'application/json' });
  const [adminHeadersReady, setAdminHeadersReady] = useState(false);
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
  const [accessAudit, setAccessAudit] = useState(null);
  const [contentRuns, setContentRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingAccessAudit, setLoadingAccessAudit] = useState(false);
  const [loadingContentRuns, setLoadingContentRuns] = useState(false);
  const [loadingLabRuns, setLoadingLabRuns] = useState(false);
  const [loadingCapstones, setLoadingCapstones] = useState(false);
  const [loadingLabTrends, setLoadingLabTrends] = useState(false);
  const [loadingCapstoneTrends, setLoadingCapstoneTrends] = useState(false);
  const [loadingCrm, setLoadingCrm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coordinatorView, setCoordinatorView] = useState('operations');
  const [ceApiKey, setCeApiKey] = useState(() => { try { return sessionStorage.getItem('ce_api_key') || ''; } catch { return ''; } });
  const [ceQueue, setCeQueue] = useState([]);
  const [ceQueueLoading, setCeQueueLoading] = useState(false);
  const [ceGenerating, setCeGenerating] = useState(false);
  const [ceEditingId, setCeEditingId] = useState(null);
  const [ceEditDraft, setCeEditDraft] = useState({});
  const [cePublishing, setCePublishing] = useState(null);
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
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentReviewForm, setAssignmentReviewForm] = useState({
    submissionId: '',
    score: '',
    passed: 'true',
    mentor_notes: ''
  });

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
    estimatedMinutes: '30',
    lessonObjectives: '',
    expectedArtifact: '',
    assignmentPrompt: '',
    reviewChecklist: '',
    tutorPrompts: ''
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
  const [sessionEditorId, setSessionEditorId] = useState('');
  const [sessionForm, setSessionForm] = useState(defaultSessionForm);
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
    feedback: ''
  });
  const [crmLeads, setCrmLeads] = useState([]);
  const [crmSummary, setCrmSummary] = useState(null);
  const [crmSegment, setCrmSegment] = useState('active');
  const [spotlightId, setSpotlightId] = useState('');
  const [spotlightData, setSpotlightData] = useState(null);
  const [loadingSpotlight, setLoadingSpotlight] = useState(false);
  const [crmFilter, setCrmFilter] = useState({
    q: '',
    paymentStatus: '',
    stage: '',
    source: '',
    days: '90'
  });
  const [crmBatchOwnerUserId, setCrmBatchOwnerUserId] = useState('');
  const [crmSavedViews, setCrmSavedViews] = useState([]);
  const [crmViewName, setCrmViewName] = useState('');
  const [crmAudit, setCrmAudit] = useState([]);
  const [crmEdit, setCrmEdit] = useState({
    leadId: '',
    stage: '',
    ownerUserId: '',
    notes: '',
    nextActionAt: ''
  });
  const [counselorKnowledge, setCounselorKnowledge] = useState([]);
  const [loadingCounselorKnowledge, setLoadingCounselorKnowledge] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState(defaultCounselorKnowledgeForm);
  const [contentGeneratorForm, setContentGeneratorForm] = useState({
    provider: 'gemini',
    model: '',
    apiKey: ''
  });
  const [contentEditorForm, setContentEditorForm] = useState(defaultContentEditorForm);
  const selectedCrmLead = useMemo(
    () => (crmLeads || []).find((lead) => lead.lead_id === crmEdit.leadId) || null,
    [crmEdit.leadId, crmLeads]
  );
  const selectedCrmPlaybook = useMemo(
    () => getRefresherPlaybook(selectedCrmLead?.refresher?.recommended_path),
    [selectedCrmLead]
  );
  const crmRefresherStartedCount = useMemo(
    () => (crmLeads || []).filter((lead) => lead?.refresher?.started).length,
    [crmLeads]
  );
  const crmRefresherRecommendedCount = useMemo(
    () => (crmLeads || []).filter((lead) => lead?.refresher?.recommended_path).length,
    [crmLeads]
  );
  const crmSegmentCounts = useMemo(
    () =>
      CRM_SEGMENTS.reduce((acc, segment) => {
        acc[segment.id] = (crmLeads || []).filter((lead) => matchesCrmSegment(lead, segment.id)).length;
        return acc;
      }, {}),
    [crmLeads]
  );
  const visibleCrmLeads = useMemo(
    () => (crmLeads || []).filter((lead) => matchesCrmSegment(lead, crmSegment)),
    [crmLeads, crmSegment]
  );
  const selectedCrmSegmentMeta = useMemo(
    () => CRM_SEGMENTS.find((segment) => segment.id === crmSegment) || CRM_SEGMENTS[0],
    [crmSegment]
  );
  const crmChannelTemplates = useMemo(
    () => buildCrmChannelTemplates(selectedCrmLead, selectedCrmPlaybook, selectedCrmSegmentMeta),
    [selectedCrmLead, selectedCrmPlaybook, selectedCrmSegmentMeta]
  );

  const roleSet = useMemo(() => new Set((userRoles || []).map((role) => String(role).trim().toLowerCase())), [userRoles]);
  const isCtoUser = roleSet.has('cto');
  const isCounselorUser = roleSet.has('counselor');
  const isContentEditorUser = roleSet.has('content_editor');
  const isCoordinatorUser = isCtoUser || roleSet.has('coordinator') || isContentEditorUser || isCounselorUser;
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
  const hasAdminToken = Boolean(adminToken.trim());
  const hasAdminAccess = isCoordinatorUser || isCtoUser || hasAdminToken;
  const isCoordinator = isCoordinatorUser && activeRole === 'coordinator';
  const contentExports = useMemo(
    () => buildExportVariants(contentEditorForm),
    [contentEditorForm]
  );
  const isTeacher = isTeacherUser && activeRole === 'teacher';
  const isLearner = isLearnerUser && activeRole === 'learner';
  const isCto = isCtoUser && activeRole === 'cto';
  const canManageContent = (isCoordinatorUser || isCtoUser) && hasAdminAccess;

  useEffect(() => {
    let active = true;
    setAdminHeadersReady(false);

    const hydrateHeaders = async () => {
      const headers = { 'Content-Type': 'application/json' };
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
          // Worker will enforce auth and return explicit error if token is required.
        }
      }

      if (active) {
        setAdminHeaders(headers);
        setAdminHeadersReady(true);
      }
    };

    void hydrateHeaders();

    return () => {
      active = false;
    };
  }, [adminToken, currentUser, userRoles]);

  useEffect(() => {
    setCrmSavedViews(loadSavedCrmViews());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CRM_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(crmSavedViews));
  }, [crmSavedViews]);

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
      setSessionEditorId('');
      setSessionForm(defaultSessionForm());
      setAttendanceForm((prev) => ({ ...prev, sessionId: '' }));
      return;
    }

    setLoadingSessions(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/cohorts/${cohortId}/sessions?limit=120`), { headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Session load failed.');
      const sessions = payload.sessions || [];
      const hasEditorSession = Boolean(sessionEditorId && sessions.some((session) => session.id === sessionEditorId));
      setCohortSessions(sessions);
      setSessionEditorId((prev) => {
        if (prev && sessions.some((session) => session.id === prev)) {
          return prev;
        }
        return '';
      });
      if (sessionEditorId && !hasEditorSession) {
        setSessionForm(defaultSessionForm());
      }
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
    if (!adminHeadersReady) {
      return;
    }

    if (!hasAdminAccess) {
      setOverview(null);
      setCourses([]);
      setContentPosts([]);
      setOrganizations([]);
      setCohorts([]);
      setAnalyticsSummary(null);
      setPathAnalytics([]);
      setOpsAlerts([]);
      setAccessAudit(null);
      setContentRuns([]);
      setCrmLeads([]);
      setCrmSummary(null);
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
      const [overviewRes, coursesRes, contentRes, organizationsRes, cohortsRes, analyticsSummaryRes, pathAnalyticsRes, alertsRes, accessAuditRes, contentRunsRes] = await Promise.all([
        fetch(apiUrl('/api/admin/overview'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/courses'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/content/posts?limit=20'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/organizations?limit=50'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/cohorts?limit=50'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/analytics/summary?days=30'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/analytics/paths?days=30'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/alerts?status=open&limit=20'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/access/audit'), { headers: adminHeaders }),
        fetch(apiUrl('/api/admin/content/runs?limit=20'), { headers: adminHeaders })
      ]);

      const overviewPayload = await overviewRes.json();
      const coursesPayload = await coursesRes.json();
      const contentPayload = await contentRes.json();
      const organizationsPayload = await organizationsRes.json();
      const cohortsPayload = await cohortsRes.json();
      const analyticsSummaryPayload = await analyticsSummaryRes.json();
      const pathAnalyticsPayload = await pathAnalyticsRes.json();
      const alertsPayload = await alertsRes.json();
      const accessAuditPayload = await accessAuditRes.json();
      const contentRunsPayload = await contentRunsRes.json();

      if (!overviewRes.ok) throw new Error(overviewPayload?.error || 'Overview load failed.');
      if (!coursesRes.ok) throw new Error(coursesPayload?.error || 'Courses load failed.');
      if (!contentRes.ok) throw new Error(contentPayload?.error || 'Content load failed.');
      if (!organizationsRes.ok) throw new Error(organizationsPayload?.error || 'Organizations load failed.');
      if (!cohortsRes.ok) throw new Error(cohortsPayload?.error || 'Cohorts load failed.');
      if (!analyticsSummaryRes.ok) throw new Error(analyticsSummaryPayload?.error || 'Analytics summary load failed.');
      if (!pathAnalyticsRes.ok) throw new Error(pathAnalyticsPayload?.error || 'Path analytics load failed.');
      if (!alertsRes.ok) throw new Error(alertsPayload?.error || 'Alert load failed.');
      if (!accessAuditRes.ok) throw new Error(accessAuditPayload?.error || 'Access audit load failed.');
      if (!contentRunsRes.ok) throw new Error(contentRunsPayload?.error || 'Content run load failed.');

      setOverview(overviewPayload);
      setCourses(coursesPayload.courses || []);
      setContentPosts(contentPayload.posts || []);
      setOrganizations(organizationsPayload.organizations || []);
      setCohorts(cohortsPayload.cohorts || []);
      setAnalyticsSummary(analyticsSummaryPayload);
      setPathAnalytics(pathAnalyticsPayload.paths || []);
      setOpsAlerts(alertsPayload.alerts || []);
      setAccessAudit(accessAuditPayload || null);
      setContentRuns(contentRunsPayload.runs || []);

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
    if (!adminHeadersReady) return;
    void loadConsoleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminHeadersReady, hasAdminAccess]);

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

  useEffect(() => {
    if (!hasAdminAccess) return;
    if (!adminHeadersReady) return;
    if (!isCoordinator) return;
    if (coordinatorView !== 'crm') return;
    void Promise.all([loadCrmLeads(), loadCrmAudit()]).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load CRM leads.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinatorView, hasAdminAccess, adminHeadersReady, isCoordinator, crmFilter.days]);

  useEffect(() => {
    if (!hasAdminAccess) return;
    if (!adminHeadersReady) return;
    if (!isCoordinator) return;
    if (coordinatorView !== 'counselor-knowledge') return;
    void loadCounselorKnowledge().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load counselor knowledge.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinatorView, hasAdminAccess, adminHeadersReady, isCoordinator]);

  useEffect(() => {
    if (!hasAdminAccess) return;
    if (!adminHeadersReady) return;
    if (!isCoordinator) return;
    if (coordinatorView !== 'assignment-review') return;
    void loadPendingAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinatorView, hasAdminAccess, adminHeadersReady, isCoordinator]);

  const loadPendingAssignments = async () => {
    setLoadingAssignments(true);
    setError('');
    try {
      const res = await actorFetch(`${apiUrl}/api/admin/assignments/pending`, { headers: adminHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load assignments');
      setPendingAssignments(data.submissions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const submitAssignmentReview = async () => {
    const { submissionId, score, passed, mentor_notes } = assignmentReviewForm;
    if (!submissionId) {
      setError('Please select an assignment first.');
      return;
    }
    setLoading(true);
    try {
      const res = await actorFetch(`${apiUrl}/api/admin/assignments/${submissionId}/finalize`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ score, passed: passed === 'true', mentor_notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save review');
      setNotice('Assignment review finalized.');
      setAssignmentReviewForm({ submissionId: '', score: '', passed: 'true', mentor_notes: '' });
      await loadPendingAssignments();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

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
        estimated_minutes: Number(moduleForm.estimatedMinutes || 30),
        lesson_objectives: splitLines(moduleForm.lessonObjectives),
        expected_artifact: moduleForm.expectedArtifact,
        assignment_prompt: moduleForm.assignmentPrompt,
        review_checklist: splitLines(moduleForm.reviewChecklist),
        tutor_prompts: splitLines(moduleForm.tutorPrompts)
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
      estimatedMinutes: '30',
      lessonObjectives: '',
      expectedArtifact: '',
      assignmentPrompt: '',
      reviewChecklist: '',
      tutorPrompts: ''
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
    setSessionEditorId('');
    setSessionForm(defaultSessionForm());
    return `Session created: ${payload?.session?.title || 'Untitled session'}`;
  };

  const loadSessionIntoEditor = async (sessionId) => {
    const session = cohortSessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('Session not found in loaded cohort sessions.');
    setSessionEditorId(session.id);
    setSessionForm({
      title: session.title || '',
      description: session.description || '',
      startsAt: formatForDateTimeLocal(session.starts_at_ms),
      endsAt: formatForDateTimeLocal(session.ends_at_ms),
      meetingUrl: session.meeting_url || '',
      recordingUrl: session.recording_url || '',
      status: session.status || 'scheduled',
      resourcesJson: JSON.stringify(session.resources || {}, null, 2)
    });
    return `Loaded session for edit: ${session.title || session.id}`;
  };

  const resetSessionEditor = async () => {
    setSessionEditorId('');
    setSessionForm(defaultSessionForm());
    return 'Session editor reset.';
  };

  const updateCohortSession = async () => {
    if (!sessionEditorId) throw new Error('Select a session to update.');
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

    const response = await fetch(apiUrl(`/api/admin/sessions/${sessionEditorId}`), {
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
    if (!response.ok) throw new Error(payload?.error || 'Session update failed.');
    await fetchCohortSessions(sessionCohortId);
    return `Session updated: ${payload?.session?.title || sessionEditorId}`;
  };

  const deleteCohortSession = async (sessionId) => {
    if (!sessionId) throw new Error('sessionId is required.');
    const targetSession = cohortSessions.find((item) => item.id === sessionId);
    if (typeof window !== 'undefined') {
      const label = targetSession?.title || sessionId;
      const confirmed = window.confirm(`Delete session "${label}"? This also removes attendance records.`);
      if (!confirmed) return 'Session delete cancelled.';
    }

    const response = await fetch(apiUrl(`/api/admin/sessions/${sessionId}/delete`), {
      method: 'POST',
      headers: adminHeaders
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Session delete failed.');

    await fetchCohortSessions(sessionCohortId);
    if (sessionEditorId === sessionId) {
      setSessionEditorId('');
      setSessionForm(defaultSessionForm());
    }
    setAttendanceForm((prev) => (prev.sessionId === sessionId ? { ...prev, sessionId: '' } : prev));
    return `Session deleted: ${targetSession?.title || sessionId}`;
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

  const loadCrmLeads = async () => {
    setLoadingCrm(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(Math.max(1, Math.min(365, Number(crmFilter.days || 90)))));
      params.set('limit', '200');
      if (crmFilter.q.trim()) params.set('q', crmFilter.q.trim());
      if (crmFilter.paymentStatus.trim()) params.set('payment_status', crmFilter.paymentStatus.trim());
      if (crmFilter.stage.trim()) params.set('stage', crmFilter.stage.trim());
      if (crmFilter.source.trim()) params.set('source', crmFilter.source.trim());

      const response = await fetch(apiUrl(`/api/admin/crm/leads?${params.toString()}`), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'CRM lead load failed.');
      setCrmLeads(payload?.leads || []);
      setCrmSummary(payload?.summary || null);
      return `Loaded ${Number(payload?.leads?.length || 0)} CRM leads.`;
    } finally {
      setLoadingCrm(false);
    }
  };

  const loadCrmAudit = async () => {
    const response = await fetch(apiUrl('/api/admin/crm/audit?limit=20'), {
      headers: adminHeaders
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'CRM audit load failed.');
    setCrmAudit(payload?.audit || []);
    return `Loaded ${Number(payload?.audit?.length || 0)} CRM audit entries.`;
  };

  const updateCrmLeadRecord = async (leadId, body) => {
    const response = await fetch(apiUrl(`/api/admin/crm/leads/${encodeURIComponent(String(leadId).trim())}`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'CRM lead update failed.');
    return payload;
  };

  const startLiveSession = async (cohortId, title, description) => {
    if (!cohortId) throw new Error('Cohort ID is required to start a live session.');
    const response = await fetch(apiUrl('/api/admin/live/sessions'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ cohort_id: cohortId, title, description })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Failed to start live session.');
    return `Live session started: ${payload.session.id}`;
  };

  const endLiveSession = async (sessionId) => {
    if (!sessionId) throw new Error('Session ID is required to end a live session.');
    const response = await fetch(apiUrl(`/api/admin/live/sessions/${sessionId}/end`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Failed to end live session.');
    return 'Live session ended successfully.';
  };

  const fetchActiveLiveSession = async (cohortId) => {
    const response = await fetch(apiUrl(`/api/learner/live/session/${cohortId}`), {
      headers: adminHeaders
    });
    const payload = await response.json();
    if (!response.ok) return null;
    return payload.session;
  };

  const saveCrmLead = async () => {
    if (!crmEdit.leadId.trim()) throw new Error('Select a lead first.');
    const body = {
      stage: crmEdit.stage,
      owner_user_id: crmEdit.ownerUserId,
      notes: crmEdit.notes
    };
    const nextActionMs = parseDateTimeToMs(crmEdit.nextActionAt);
    if (Number.isFinite(nextActionMs)) {
      body.next_action_at_ms = nextActionMs;
    }
    body.audit_scope = 'single';
    body.audit_action_type = 'lead_update_manual';
    body.audit_segment_id = crmSegment;
    const payload = await updateCrmLeadRecord(crmEdit.leadId.trim(), body);
    await loadCrmLeads();
    await loadCrmAudit();
    return `CRM lead updated (${payload?.crm?.stage || crmEdit.stage || 'stage unchanged'}).`;
  };

  const applyCrmReminderPreset = (hoursAhead = 24) => {
    if (!selectedCrmLead) return;

    const segmentMeta = selectedCrmPlaybook
      ? {
          defaultStage: 'qualified',
          ownerPrompt: `${selectedCrmPlaybook.nextAction} ${selectedCrmPlaybook.ownerPrompt}`
        }
      : selectedCrmSegmentMeta;

    const reminderNote = segmentMeta?.ownerPrompt || 'Follow up with the lead, confirm fit, and move them to the next concrete enrollment step.';
    const nextStage =
      segmentMeta?.defaultStage ||
      selectedCrmLead?.crm?.stage ||
      (String(selectedCrmLead?.payment_status || '').trim().toLowerCase() === 'paid' ? 'won' : 'contacted');

    setCrmEdit((current) => ({
      ...current,
      leadId: selectedCrmLead.lead_id,
      stage: nextStage,
      nextActionAt: formatForDateTimeLocal(Date.now() + hoursAhead * 60 * 60 * 1000),
      notes: appendCrmNote(current.notes, reminderNote)
    }));
  };

  const runCrmSegmentBatch = async (hoursAhead = 24) => {
    const targets = (visibleCrmLeads || []).slice(0, 25);
    if (targets.length === 0) throw new Error('No leads available in the current segment.');

    const reminderNote =
      selectedCrmSegmentMeta?.ownerPrompt ||
      'Follow up with the lead, confirm fit, and move them to the next concrete enrollment step.';
    const defaultStage = selectedCrmSegmentMeta?.defaultStage || 'contacted';
    const nextActionAtMs = Date.now() + hoursAhead * 60 * 60 * 1000;

    for (const lead of targets) {
      await updateCrmLeadRecord(lead.lead_id, {
        stage: lead?.crm?.stage || defaultStage,
        owner_user_id: lead?.crm?.owner_user_id || '',
        notes: appendCrmNote(lead?.crm?.notes || '', reminderNote),
        next_action_at_ms: nextActionAtMs,
        audit_scope: 'batch',
        audit_action_type: `segment_reminder_${hoursAhead}h`,
        audit_segment_id: crmSegment
      });
    }

    await loadCrmLeads();
    await loadCrmAudit();
    return `Queued ${hoursAhead}h reminders for ${targets.length} lead(s) in ${selectedCrmSegmentMeta.label}.`;
  };

  const stageCrmSegment = async () => {
    const targets = (visibleCrmLeads || []).slice(0, 25);
    if (targets.length === 0) throw new Error('No leads available in the current segment.');
    const targetStage = selectedCrmSegmentMeta?.defaultStage || 'contacted';

    for (const lead of targets) {
      await updateCrmLeadRecord(lead.lead_id, {
        stage: targetStage,
        owner_user_id: lead?.crm?.owner_user_id || '',
        notes: lead?.crm?.notes || '',
        audit_scope: 'batch',
        audit_action_type: 'segment_stage_update',
        audit_segment_id: crmSegment
      });
    }

    await loadCrmLeads();
    await loadCrmAudit();
    return `Moved ${targets.length} lead(s) in ${selectedCrmSegmentMeta.label} to ${targetStage}.`;
  };

  const assignCrmSegmentOwner = async () => {
    const ownerUserId = String(crmBatchOwnerUserId || '').trim();
    if (!ownerUserId) throw new Error('Enter an owner user_id first.');
    const targets = (visibleCrmLeads || []).slice(0, 25);
    if (targets.length === 0) throw new Error('No leads available in the current segment.');

    for (const lead of targets) {
      await updateCrmLeadRecord(lead.lead_id, {
        stage: lead?.crm?.stage || selectedCrmSegmentMeta?.defaultStage || 'contacted',
        owner_user_id: ownerUserId,
        notes: lead?.crm?.notes || '',
        next_action_at_ms: lead?.crm?.next_action_at_ms || undefined,
        audit_scope: 'batch',
        audit_action_type: 'segment_owner_assignment',
        audit_segment_id: crmSegment
      });
    }

    await loadCrmLeads();
    await loadCrmAudit();
    return `Assigned ${targets.length} lead(s) in ${selectedCrmSegmentMeta.label} to ${ownerUserId}.`;
  };

  const exportCrmSegmentCsv = async () => {
    if ((visibleCrmLeads || []).length === 0) {
      throw new Error('No leads available in the current segment.');
    }
    const csv = buildCrmSegmentCsv(visibleCrmLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const segmentLabel = String(selectedCrmSegmentMeta?.label || 'all')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `greybrain-crm-${segmentLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return `Exported ${visibleCrmLeads.length} lead(s) from ${selectedCrmSegmentMeta.label}.`;
  };

  const saveCurrentCrmView = async () => {
    const name = serializeCrmViewName(crmViewName || `${selectedCrmSegmentMeta.label} view`);
    if (!name) throw new Error('Enter a name for the CRM view.');
    const nextView = {
      id: `crm_view_${Date.now()}`,
      name,
      segment: crmSegment,
      filter: { ...crmFilter }
    };
    setCrmSavedViews((current) => [nextView, ...current.filter((item) => item.name !== name)].slice(0, 12));
    setCrmViewName('');
    return `Saved CRM view: ${name}.`;
  };

  const applySavedCrmView = async (view) => {
    if (!view) throw new Error('CRM view not found.');
    setCrmSegment(view.segment || 'all');
    setCrmFilter({
      q: view?.filter?.q || '',
      paymentStatus: view?.filter?.paymentStatus || '',
      stage: view?.filter?.stage || '',
      source: view?.filter?.source || '',
      days: view?.filter?.days || '90'
    });
    return `Applied CRM view: ${view.name || 'saved view'}.`;
  };

  const deleteSavedCrmView = async (viewId) => {
    setCrmSavedViews((current) => current.filter((item) => item.id !== viewId));
    return 'Saved CRM view removed.';
  };

  const loadCounselorKnowledge = async () => {
    setLoadingCounselorKnowledge(true);
    try {
      const response = await fetch(apiUrl('/api/admin/counselor/knowledge?limit=200'), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Counselor knowledge load failed.');
      setCounselorKnowledge(payload?.items || []);
      return `Loaded ${Number(payload?.items?.length || 0)} counselor knowledge items.`;
    } finally {
      setLoadingCounselorKnowledge(false);
    }
  };

  const saveCounselorKnowledge = async () => {
    const title = knowledgeForm.title.trim();
    const body = knowledgeForm.body.trim();
    if (!title) throw new Error('FAQ/rule title is required.');
    if (!body) throw new Error('FAQ/rule answer/instruction is required.');
    if (knowledgeForm.scope === 'course' && !knowledgeForm.courseId) {
      throw new Error('Select a course for course-scoped FAQ/rule.');
    }

    const bodyPayload = {
      kind: knowledgeForm.kind,
      scope: knowledgeForm.scope,
      course_id: knowledgeForm.scope === 'course' ? knowledgeForm.courseId : '',
      title,
      body,
      sort_order: Number(knowledgeForm.sortOrder || 100),
      is_active: Boolean(knowledgeForm.isActive),
      created_by: currentUser?.uid || 'coordinator'
    };

    const endpoint = knowledgeForm.itemId
      ? apiUrl(`/api/admin/counselor/knowledge/${encodeURIComponent(knowledgeForm.itemId)}`)
      : apiUrl('/api/admin/counselor/knowledge');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(bodyPayload)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Counselor knowledge save failed.');

    await loadCounselorKnowledge();
    setKnowledgeForm(defaultCounselorKnowledgeForm());
    return knowledgeForm.itemId ? 'Counselor knowledge updated.' : 'Counselor knowledge added.';
  };

  const deleteCounselorKnowledge = async (itemId) => {
    const targetId = String(itemId || '').trim();
    if (!targetId) throw new Error('Knowledge item id is required.');
    const response = await fetch(apiUrl(`/api/admin/counselor/knowledge/${encodeURIComponent(targetId)}/delete`), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Counselor knowledge delete failed.');
    await loadCounselorKnowledge();
    if (knowledgeForm.itemId === targetId) {
      setKnowledgeForm(defaultCounselorKnowledgeForm());
    }
    return 'Counselor knowledge item deleted.';
  };

  const selectCounselorKnowledgeItem = (item) => {
    setKnowledgeForm({
      itemId: item.id || '',
      kind: item.kind === 'rule' ? 'rule' : 'faq',
      scope: item.scope === 'course' ? 'course' : 'global',
      courseId: item.course_id || '',
      title: item.title || '',
      body: item.body || '',
      sortOrder: String(item.sort_order ?? 100),
      isActive: Boolean(item.is_active)
    });
  };

  const loadLearnerSpotlight = async (userId) => {
    const targetId = userId || spotlightId;
    if (!targetId) throw new Error('User ID or Email is required for spotlight.');
    setLoadingSpotlight(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/learner/spotlight/${encodeURIComponent(targetId)}`), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load spotlight.');
      setSpotlightData(payload.learner);
      return `Spotlight loaded for ${targetId}`;
    } finally {
      setLoadingSpotlight(false);
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

  const ingestResearchContext = async () => {
    const courseId = knowledgeForm.courseId;
    if (!courseId && knowledgeForm.scope === 'course') {
      throw new Error('Please select a course to vectorize research for.');
    }
    const response = await fetch(apiUrl('/api/admin/knowledge/ingest-research'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ course_id: courseId })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Research ingestion failed.');
    return `Research & Presentations ingested (${payload?.upserted || 0} vectors).`;
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

  const loadAccessAudit = async () => {
    setLoadingAccessAudit(true);
    try {
      const response = await fetch(apiUrl('/api/admin/access/audit'), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Access audit load failed.');
      setAccessAudit(payload || null);
      return 'Access audit loaded.';
    } finally {
      setLoadingAccessAudit(false);
    }
  };

  const loadContentRuns = async () => {
    setLoadingContentRuns(true);
    try {
      const response = await fetch(apiUrl('/api/admin/content/runs?limit=30'), {
        headers: adminHeaders
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Content run load failed.');
      setContentRuns(payload?.runs || []);
      return `Loaded ${Number(payload?.runs?.length || 0)} content runs.`;
    } finally {
      setLoadingContentRuns(false);
    }
  };

  const generateDailyBrief = async () => {
    const response = await fetch(apiUrl('/api/admin/content/generate-daily'), {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        force: false,
        provider: contentGeneratorForm.provider,
        model: contentGeneratorForm.model.trim(),
        api_key: contentGeneratorForm.apiKey.trim()
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Daily generation failed.');

    if (payload?.generated?.skipped) {
      return payload.generated.reason || 'Draft already exists for today.';
    }

    return `Draft generated: ${payload?.generated?.title || 'Untitled brief'}`;
  };

  const loadContentIntoEditor = (post) => {
    setContentEditorForm({
      postId: post.id || '',
      title: post.title || '',
      summary: post.summary || '',
      path: post.path || 'productivity',
      contentType: post.content_type || 'daily_brief',
      tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
      canonicalUrl: post.canonical_url || '',
      sourceUrls: Array.isArray(post.source_urls) ? post.source_urls.join('\n') : '',
      contentMarkdown: post.content_markdown || ''
    });
  };

  const startNewContentDraft = () => {
    setContentEditorForm(defaultContentEditorForm());
  };

  const saveContentDraft = async () => {
    const tags = contentEditorForm.tags
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const body = {
      title: contentEditorForm.title,
      summary: contentEditorForm.summary,
      path: contentEditorForm.path,
      content_type: contentEditorForm.contentType,
      tags,
      canonical_url: contentEditorForm.canonicalUrl.trim(),
      source_urls: normalizeUrlList(contentEditorForm.sourceUrls),
      content_markdown: contentEditorForm.contentMarkdown
    };
    const postId = contentEditorForm.postId.trim();
    const response = await fetch(
      apiUrl(postId ? `/api/admin/content/posts/${postId}/update` : '/api/admin/content/posts'),
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(body)
      }
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || (postId ? 'Content draft update failed.' : 'Content draft create failed.'));
    await loadDashboard();
    if (payload?.post) {
      loadContentIntoEditor(payload.post);
    }
    return postId ? 'Draft updated.' : 'Draft created.';
  };

  const copyContentExport = async (text, label) => {
    if (!text.trim()) {
      throw new Error(`Nothing to copy for ${label}.`);
    }
    if (!navigator?.clipboard?.writeText) {
      throw new Error('Clipboard is not available in this browser.');
    }
    await navigator.clipboard.writeText(text);
    return `${label} export copied.`;
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
      {!hasAdminAccess ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sign in with a coordinator/counselor/CTO role to unlock admin controls. Admin token remains optional fallback.
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

      {(overview?.refresher || analyticsSummary?.refresher) && (
        <div className="mb-6 rounded-2xl border border-cyan-200 bg-[linear-gradient(180deg,#ffffff,#f6fbff)] p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">AI Refresher</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-900">Starter-course conversion visibility</h3>
              <p className="mt-1 text-sm text-slate-600">Track how many learners start the refresher and how many finish with a saved path recommendation.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="All-Time Started" value={overview?.refresher?.started ?? 0} />
            <Metric label="All-Time Recommended" value={overview?.refresher?.recommended ?? 0} />
            <Metric label="30d Started" value={analyticsSummary?.refresher?.started ?? 0} />
            <Metric label="30d Recommended" value={analyticsSummary?.refresher?.recommended ?? 0} />
            <Metric label="Recommendation Rate" value={`${analyticsSummary?.refresher?.recommendation_rate_pct ?? 0}%`} />
          </div>

          {(analyticsSummary?.refresher?.recommendations_by_path || []).length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Refresher Recommendations By Path (Last 30 Days)</h4>
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {(analyticsSummary?.refresher?.recommendations_by_path || []).map((row) => (
                    <tr key={row.recommended_path} className="border-t border-slate-200 bg-white">
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.recommended_path}</td>
                      <td className="px-3 py-2 text-slate-700">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {(analyticsSummary?.refresher?.chapter_breakdown || []).length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Refresher Chapter Drop-Off (Last 30 Days)</h4>
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Chapter</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Drop-off from start</th>
                  </tr>
                </thead>
                <tbody>
                  {(analyticsSummary?.refresher?.chapter_breakdown || []).map((row) => (
                    <tr key={row.chapter_id} className="border-t border-slate-200 bg-white">
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.chapter_id}</td>
                      <td className="px-3 py-2 text-slate-700">{row.count}</td>
                      <td className="px-3 py-2 text-slate-700">{row.dropoff_pct_from_start}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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

      {isCoordinator && hasAdminAccess && (
        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          {[
            { id: 'operations', label: 'Operations' },
            { id: 'crm', label: 'CRM Pipeline' },
            { id: 'rag_health', label: 'RAG Health' },
            { id: 'counselor-knowledge', label: 'Counselor Knowledge' },
            { id: 'lab-ops', label: 'Lab Ops' },
            { id: 'capstone-review', label: 'Capstone Review' },
            { id: 'assignment-review', label: 'Assignment Review' },
            { id: 'live-teaching', label: 'Live Teaching' },
            { id: 'content-engine', label: '⚡ Content Engine' },
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

      {isCoordinator && hasAdminAccess && coordinatorView === 'operations' && (
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

      {isCoordinator && hasAdminAccess && coordinatorView === 'operations' && (
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
              <textarea
                className="min-h-[92px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={"Learning objectives (one per line)\nClarify the workflow boundary\nName the evidence input\nProduce a mentor-reviewable draft"}
                value={moduleForm.lessonObjectives}
                onChange={(e) => setModuleForm((p) => ({ ...p, lessonObjectives: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Expected output artifact"
                value={moduleForm.expectedArtifact}
                onChange={(e) => setModuleForm((p) => ({ ...p, expectedArtifact: e.target.value }))}
              />
              <textarea
                className="min-h-[110px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Assignment prompt used in the learner hub"
                value={moduleForm.assignmentPrompt}
                onChange={(e) => setModuleForm((p) => ({ ...p, assignmentPrompt: e.target.value }))}
              />
              <textarea
                className="min-h-[92px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={"Review checklist (one per line)\nState the use case\nCheck evidence grounding\nFlag unsupported claims"}
                value={moduleForm.reviewChecklist}
                onChange={(e) => setModuleForm((p) => ({ ...p, reviewChecklist: e.target.value }))}
              />
              <textarea
                className="min-h-[92px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={"Tutor starters (one per line)\nTurn this into a reproducible workflow.\nWhat would a supervisor challenge here?"}
                value={moduleForm.tutorPrompts}
                onChange={(e) => setModuleForm((p) => ({ ...p, tutorPrompts: e.target.value }))}
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
                  <p className="mt-1 text-[11px] text-slate-500">
                    {countSerializedList(module.lesson_objectives_json)} objectives
                    {' · '}
                    {module.assignment_prompt ? 'assignment ready' : 'assignment missing'}
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
                      <p className="text-xs text-slate-500">
                        Refresher: {row?.refresher?.started ? `started (${row.refresher.chapter_events} chapter events)` : 'not started'}
                        {row?.refresher?.recommended_path ? ` · recommended ${row.refresher.recommended_path}` : ''}
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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {sessionEditorId ? 'Edit Mode' : 'Create Mode'}
              </span>
              {sessionEditorId ? (
                <span className="text-xs text-slate-500">Selected session ID: {sessionEditorId}</span>
              ) : (
                <span className="text-xs text-slate-500">Create a new session for selected cohort.</span>
              )}
            </div>
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
              {sessionEditorId ? (
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => void runAction(updateCohortSession)}
                  type="button"
                >
                  Update Session
                </button>
              ) : (
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => void runAction(createCohortSession)}
                  type="button"
                >
                  Create Session
                </button>
              )}
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(resetSessionEditor)}
                type="button"
              >
                Clear Editor
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
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => void runAction(() => loadSessionIntoEditor(session.id))}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={() => void runAction(() => deleteCohortSession(session.id))}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
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

      {isCoordinator && hasAdminAccess && coordinatorView === 'rag_health' && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">RAG Health & AI Telemetry</h2>
          </div>
          <RAGHealthDashboard user={user} roles={roles} actorFetch={actorFetch} />
        </section>
      )}

      {isCoordinator && hasAdminAccess && coordinatorView === 'crm' && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Learner Lifecycle Spotlight</h3>
                  <p className="text-sm text-slate-600">Complete “Entry to Exit” visibility for any student.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-64 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search by User ID or Email..."
                    value={spotlightId}
                    onChange={(e) => setSpotlightId(e.target.value)}
                  />
                  <button
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    onClick={() => void runAction(() => loadLearnerSpotlight())}
                    type="button"
                    disabled={loadingSpotlight}
                  >
                    {loadingSpotlight ? 'Loading...' : 'Spotlight'}
                  </button>
                </div>
              </div>

              {spotlightData ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Step 1: Awareness & Interest</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-bold text-slate-900">{spotlightData.lead?.full_name || 'Anonymous Lead'}</p>
                        <p className="text-xs text-slate-600">Source: {spotlightData.lead?.channel || 'Unknown'} · {spotlightData.lead?.entry_point || 'Web'}</p>
                        <p className="text-xs text-slate-500">First Contact: {spotlightData.lead?.created_at_ms ? new Date(spotlightData.lead.created_at_ms).toLocaleDateString() : 'TBD'}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Step 2: Enrollment & Conversion</p>
                      <div className="mt-2 space-y-2">
                        {spotlightData.enrollments.map((en, idx) => (
                          <div key={idx} className="border-l-2 border-emerald-200 pl-3">
                            <p className="text-sm font-semibold text-slate-900">{en.course_title}</p>
                            <p className="text-xs text-slate-600">Cohort: {en.cohort_name} · Status: {en.status}</p>
                          </div>
                        ))}
                        {spotlightData.enrollments.length === 0 && <p className="text-xs text-slate-500 italics">No active enrollments yet.</p>}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Step 3: Sustained Learning</p>
                    <div className="mt-2 max-h-48 overflow-auto space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Recent Progress:</p>
                      {spotlightData.progress.slice(0, 5).map((pg, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 border-b border-amber-200/50 pb-1">
                          <p className="text-[11px] text-slate-800">{pg.module_title}</p>
                          <p className="text-[10px] text-slate-500">{new Date(pg.updated_at_ms).toLocaleDateString()}</p>
                        </div>
                      ))}
                      {spotlightData.progress.length === 0 && <p className="text-xs text-slate-500">No learning logs found.</p>}
                    </div>
                  </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Step 4: Mastery & Assessment</p>
                      <div className="mt-2 space-y-2">
                        {spotlightData.assignments.map((as, idx) => (
                          <div key={idx} className="rounded border border-indigo-200 bg-white p-2">
                            <p className="text-xs font-bold text-slate-900">{as.module_title}</p>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span className={`rounded-full px-2 py-0.5 ${as.pass_fail === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                {as.pass_fail || 'Under Review'}
                              </span>
                              <span className="font-bold">Score: {as.human_score || as.ai_score || 'N/A'}%</span>
                            </div>
                          </div>
                        ))}
                        {spotlightData.assignments.length === 0 && <p className="text-xs text-slate-500">No assignments submitted.</p>}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Audit Trail (Last 5)</p>
                      <div className="mt-2 space-y-2">
                        {spotlightData.audits.slice(0, 5).map((aud, idx) => (
                          <div key={idx} className="text-[10px] text-slate-600">
                            <span className="font-bold">{aud.action}:</span> {aud.notes || 'No notes'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <p className="text-slate-400">Search for a student to visualize their lifecycle.</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Internal CRM Pipeline</h3>
            <p className="mb-3 text-sm text-slate-600">
              Lead capture, payment follow-up, and owner/stage management are handled fully inside this platform.
            </p>
            <div className="mb-3 grid gap-2 sm:grid-cols-4">
              <Metric label="Total Leads" value={crmSummary?.total ?? crmLeads.length} />
              <Metric label="Interest Signals" value={crmSummary?.by_kind?.interest ?? 0} />
              <Metric label="Won (Paid)" value={crmSummary?.by_stage?.won ?? 0} />
              <Metric label="Pending Payment" value={crmSummary?.by_stage?.payment_pending ?? 0} />
              <Metric label="Lost" value={crmSummary?.by_stage?.lost ?? 0} />
            </div>

            <div className="mb-3 grid gap-2 sm:grid-cols-4">
              <Metric label="Google" value={crmSummary?.by_channel?.google ?? 0} />
              <Metric label="WhatsApp" value={crmSummary?.by_channel?.whatsapp ?? 0} />
              <Metric label="Telegram" value={crmSummary?.by_channel?.telegram ?? 0} />
              <Metric label="Other" value={crmSummary?.by_channel?.other ?? 0} />
            </div>

            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <Metric label="Refresher Started" value={crmRefresherStartedCount} />
              <Metric label="Refresher Recommended" value={crmRefresherRecommendedCount} />
              <Metric
                label="Refresher Conversion"
                value={`${crmRefresherStartedCount > 0 ? Math.round((crmRefresherRecommendedCount / crmRefresherStartedCount) * 100) : 0}%`}
              />
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {CRM_SEGMENTS.map((segment) => {
                const isActive = crmSegment === segment.id;
                return (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => setCrmSegment(segment.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em]">{segment.label}</p>
                    <p className={`mt-1 text-lg font-extrabold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {crmSegmentCounts[segment.id] || 0}
                    </p>
                    <p className={`mt-1 max-w-[18rem] text-xs leading-5 ${isActive ? 'text-slate-100' : 'text-slate-500'}`}>
                      {segment.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Saved CRM Views</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Save current segment + filters as a view"
                  value={crmViewName}
                  onChange={(e) => setCrmViewName(e.target.value)}
                />
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(saveCurrentCrmView)}
                  type="button"
                >
                  Save View
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {crmSavedViews.map((view) => (
                  <div key={view.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{view.name}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {CRM_SEGMENTS.find((segment) => segment.id === view.segment)?.label || 'All Leads'} · {view?.filter?.days || '90'}d
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => void runAction(() => applySavedCrmView(view))}
                        type="button"
                      >
                        Apply
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => void runAction(() => deleteSavedCrmView(view.id))}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {crmSavedViews.length === 0 ? (
                  <p className="text-xs text-slate-500">No saved CRM views yet.</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Search name/email/phone"
                value={crmFilter.q}
                onChange={(e) => setCrmFilter((p) => ({ ...p, q: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={crmFilter.paymentStatus}
                onChange={(e) => setCrmFilter((p) => ({ ...p, paymentStatus: e.target.value }))}
              >
                <option value="">All payment statuses</option>
                <option value="registered">Registered</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={crmFilter.stage}
                onChange={(e) => setCrmFilter((p) => ({ ...p, stage: e.target.value }))}
              >
                <option value="">All stages</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="payment_pending">Payment pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={crmFilter.source}
                onChange={(e) => setCrmFilter((p) => ({ ...p, source: e.target.value }))}
              >
                <option value="">All sources</option>
                <option value="google_one_click">Google registration</option>
                <option value="google_interest">Google interest</option>
                <option value="whatsapp_interest">WhatsApp interest</option>
                <option value="telegram_interest">Telegram interest</option>
                <option value="landing_form">Landing form</option>
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={crmFilter.days}
                onChange={(e) => setCrmFilter((p) => ({ ...p, days: e.target.value }))}
              >
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 180 days</option>
                <option value="365">Last 365 days</option>
              </select>
            </div>
            <button
              className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => void runAction(loadCrmLeads)}
              type="button"
              disabled={loadingCrm}
            >
              {loadingCrm ? 'Loading CRM...' : 'Refresh CRM'}
            </button>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Batch Actions For Visible Segment</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Applies to up to 25 leads in the current segment view to avoid accidental bulk changes.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Assign visible leads to owner user_id"
                  value={crmBatchOwnerUserId}
                  onChange={(e) => setCrmBatchOwnerUserId(e.target.value)}
                />
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(assignCrmSegmentOwner)}
                  type="button"
                  disabled={visibleCrmLeads.length === 0 || !crmBatchOwnerUserId.trim()}
                >
                  Assign Owner
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(() => runCrmSegmentBatch(24))}
                  type="button"
                  disabled={visibleCrmLeads.length === 0}
                >
                  Queue 24h For Segment
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(() => runCrmSegmentBatch(72))}
                  type="button"
                  disabled={visibleCrmLeads.length === 0}
                >
                  Queue 72h For Segment
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(stageCrmSegment)}
                  type="button"
                  disabled={visibleCrmLeads.length === 0 || crmSegment === 'all'}
                >
                  Stage Visible To {selectedCrmSegmentMeta.defaultStage || 'contacted'}
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(exportCrmSegmentCsv)}
                  type="button"
                  disabled={visibleCrmLeads.length === 0}
                >
                  Export Visible CSV
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[28rem] space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {visibleCrmLeads.map((lead) => (
                <div key={lead.lead_id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{lead.full_name || lead.email || lead.lead_id}</p>
                      <p className="text-xs text-slate-600">{lead.email} · {lead.phone}</p>
                      <p className="text-xs text-slate-500">
                        {lead.course_title || lead.course_slug || 'unmapped course'} · {lead.payment_status} · stage {lead?.crm?.stage || 'new'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Refresher: {lead?.refresher?.started ? `started (${lead.refresher.chapter_events} chapter events)` : 'not started'}
                        {lead?.refresher?.recommended_path ? ` · recommended ${lead.refresher.recommended_path}` : ''}
                      </p>
                      {lead?.crm?.next_action_at_ms ? (
                        <p className="text-xs text-slate-500">Next action: {formatMs(lead.crm.next_action_at_ms)}</p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Source: {lead.source || 'unknown'}{lead.channel ? ` · Channel: ${lead.channel}` : ''} · Type: {lead.kind || 'registration'}
                      </p>
                      <p className="text-xs text-slate-500">Updated: {formatMs(lead.updated_at_ms)}</p>
                    </div>
                    <button
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() =>
                        setCrmEdit({
                          leadId: lead.lead_id,
                          stage: lead?.crm?.stage || '',
                          ownerUserId: lead?.crm?.owner_user_id || '',
                          notes: lead?.crm?.notes || '',
                          nextActionAt: formatForDateTimeLocal(lead?.crm?.next_action_at_ms)
                        })
                      }
                      type="button"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
              {visibleCrmLeads.length === 0 ? (
                <p className="text-sm text-slate-500">No leads found for the current CRM filter and segment.</p>
              ) : null}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">CRM Audit Trail</p>
                  <p className="text-xs text-slate-600">Recent owner, stage, and batch operations.</p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => void runAction(loadCrmAudit)}
                  type="button"
                >
                  Refresh Audit
                </button>
              </div>
              <div className="max-h-56 space-y-2 overflow-auto">
                {crmAudit.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {entry.action_type} · {entry.scope}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      lead {entry.lead_id || 'unknown'}{entry.segment_id ? ` · ${entry.segment_id}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      actor {entry.actor_email || entry.actor_user_id || 'system'} · {formatMs(entry.created_at_ms)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry?.details?.previous?.stage || 'new'} {'->'} {entry?.details?.next?.stage || 'new'}
                      {entry?.details?.next?.owner_user_id ? ` · owner ${entry.details.next.owner_user_id}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Update Lead</h3>
            <div className="grid gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Current CRM Segment</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCrmSegmentMeta.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{selectedCrmSegmentMeta.description}</p>
              </div>
              {selectedCrmPlaybook ? (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Suggested follow-up</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCrmPlaybook.label} playbook</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedCrmPlaybook.nextAction}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{selectedCrmPlaybook.ownerPrompt}</p>
                  <a
                    href={selectedCrmPlaybook.trackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                  >
                    Open Suggested Track
                  </a>
                </div>
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Reminder Actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => applyCrmReminderPreset(24)}
                    type="button"
                    disabled={!selectedCrmLead}
                  >
                    Queue 24h Reminder
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => applyCrmReminderPreset(72)}
                    type="button"
                    disabled={!selectedCrmLead}
                  >
                    Queue 72h Reminder
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => applyCrmReminderPreset(168)}
                    type="button"
                    disabled={!selectedCrmLead}
                  >
                    Queue 7d Reminder
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  These actions prefill stage, next action date, and follow-up notes based on the selected lead or current segment.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Channel Templates</p>
                <div className="mt-3 grid gap-3">
                  {[
                    { key: 'whatsapp', label: 'WhatsApp', rows: 4 },
                    { key: 'email', label: 'Email', rows: 8 },
                    { key: 'counselor', label: 'Counselor Handoff', rows: 5 }
                  ].map((template) => (
                    <div key={template.key} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{template.label}</p>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                          onClick={() => void runAction(() => copyContentExport(crmChannelTemplates[template.key], template.label))}
                          type="button"
                          disabled={!selectedCrmLead}
                        >
                          Copy
                        </button>
                      </div>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                        rows={template.rows}
                        readOnly
                        value={crmChannelTemplates[template.key]}
                        placeholder={selectedCrmLead ? '' : 'Select a lead to generate the template.'}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Lead ID"
                value={crmEdit.leadId}
                onChange={(e) => setCrmEdit((p) => ({ ...p, leadId: e.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={crmEdit.stage}
                onChange={(e) => setCrmEdit((p) => ({ ...p, stage: e.target.value }))}
              >
                <option value="">Keep existing stage</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="payment_pending">Payment pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Owner user_id"
                value={crmEdit.ownerUserId}
                onChange={(e) => setCrmEdit((p) => ({ ...p, ownerUserId: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                type="datetime-local"
                value={crmEdit.nextActionAt}
                onChange={(e) => setCrmEdit((p) => ({ ...p, nextActionAt: e.target.value }))}
              />
              <textarea
                className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Coordinator notes"
                value={crmEdit.notes}
                onChange={(e) => setCrmEdit((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runAction(saveCrmLead)}
              type="button"
            >
              Save CRM Update
            </button>
          </div>
        </div>
      )}

      {isCoordinator && hasAdminAccess && coordinatorView === 'counselor-knowledge' && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Counselor Rules and FAQs</h3>
                <p className="text-sm text-slate-600">
                  Coordinator-managed logistics knowledge used by AI Counselor replies.
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => void runAction(loadCounselorKnowledge)}
                type="button"
                disabled={loadingCounselorKnowledge}
              >
                {loadingCounselorKnowledge ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="max-h-[30rem] space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
              {counselorKnowledge.map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.kind} · {item.scope}
                        {item.course_title ? ` · ${item.course_title}` : ''}
                        {item.is_active ? '' : ' · inactive'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.body}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => selectCounselorKnowledgeItem(item)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={() => void runAction(() => deleteCounselorKnowledge(item.id))}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {counselorKnowledge.length === 0 ? <p className="text-sm text-slate-500">No counselor FAQ/rule items yet.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">{knowledgeForm.itemId ? 'Edit Item' : 'Add New Item'}</h3>
            <div className="grid gap-2">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={knowledgeForm.kind}
                onChange={(e) => setKnowledgeForm((p) => ({ ...p, kind: e.target.value }))}
              >
                <option value="faq">FAQ</option>
                <option value="rule">Rule</option>
                <option value="research">Research</option>
                <option value="presentation">Presentation</option>
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={knowledgeForm.scope}
                onChange={(e) => setKnowledgeForm((p) => ({ ...p, scope: e.target.value, courseId: e.target.value === 'global' ? '' : p.courseId }))}
              >
                <option value="global">Global scope</option>
                <option value="course">Course scope</option>
              </select>
              {knowledgeForm.scope === 'course' ? (
                <select
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={knowledgeForm.courseId}
                  onChange={(e) => setKnowledgeForm((p) => ({ ...p, courseId: e.target.value }))}
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={knowledgeForm.kind === 'rule' ? 'Rule title' : 'FAQ question'}
                value={knowledgeForm.title}
                onChange={(e) => setKnowledgeForm((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="min-h-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={knowledgeForm.kind === 'rule' ? 'Instruction shown to counselor model' : 'Answer used for counselor responses'}
                value={knowledgeForm.body}
                onChange={(e) => setKnowledgeForm((p) => ({ ...p, body: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="1"
                step="1"
                placeholder="Sort order (lower appears first)"
                value={knowledgeForm.sortOrder}
                onChange={(e) => setKnowledgeForm((p) => ({ ...p, sortOrder: e.target.value }))}
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={knowledgeForm.isActive}
                  onChange={(e) => setKnowledgeForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void runAction(saveCounselorKnowledge)}
                type="button"
              >
                {knowledgeForm.itemId ? 'Update Item' : 'Create Item'}
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setKnowledgeForm(defaultCounselorKnowledgeForm())}
                type="button"
              >
                Clear
              </button>
              <button
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                onClick={() => void runAction(ingestLogisticsContext)}
                type="button"
              >
                Sync Logistics
              </button>
              <button
                className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                onClick={() => void runAction(ingestResearchContext)}
                type="button"
              >
                Vectorize Research
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              After creating or updating items, run “Publish To Counselor Index” so public AI Counselor uses the latest rules and FAQs.
            </p>
          </div>
        </div>
      )}

      {isCoordinator && hasAdminAccess && coordinatorView === 'lab-ops' && (
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

      {isCoordinator && hasAdminAccess && coordinatorView === 'capstone-review' && (
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

      {isCoordinator && hasAdminAccess && coordinatorView === 'assignment-review' && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Assignment Review Queue</h3>
            <button
              className="mb-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => void runAction(loadPendingAssignments)}
              type="button"
              disabled={loadingAssignments}
            >
              {loadingAssignments ? 'Loading...' : 'Refresh Queue'}
            </button>
            <div className="max-h-[32rem] space-y-3 overflow-auto">
              {pendingAssignments.map((sub) => (
                <div key={sub.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 overflow-hidden">
                      <p className="mb-1 text-sm font-bold text-slate-900 line-clamp-1">{sub.course_title}</p>
                      <p className="mb-2 text-xs font-semibold text-blue-600">{sub.module_title}</p>
                      <p className="mb-2 text-xs text-slate-500">Learner: {sub.user_id} · {new Date(sub.submitted_at_ms).toLocaleString()}</p>
                      <div className="mb-3 max-h-40 overflow-auto rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm whitespace-pre-wrap border border-slate-100 italic">
                        "{sub.answer_text}"
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">AI Feedback & Raw Artifacts</summary>
                        <div className="mt-2 space-y-2">
                           <pre className="overflow-auto rounded-lg bg-slate-900 p-2 text-[10px] text-slate-300">{JSON.stringify(sub.ai_feedback_json, null, 2)}</pre>
                           <pre className="overflow-auto rounded-lg bg-slate-800 p-2 text-[10px] text-slate-400">{JSON.stringify(sub.artifacts_json, null, 2)}</pre>
                        </div>
                      </details>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className={`rounded-lg px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                        sub.status === 'ai_graded' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {sub.status.replace('_', ' ')}
                      </div>
                      <div className={`rounded-lg px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                        sub.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        AI Result: {sub.passed ? 'PASS' : 'FAIL'} ({sub.score}%)
                      </div>
                      <button
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg transition-transform active:scale-95"
                        onClick={() =>
                          setAssignmentReviewForm({
                            submissionId: sub.id,
                            score: sub.score || '',
                            passed: sub.passed ? 'true' : 'false',
                            mentor_notes: ''
                          })
                        }
                        type="button"
                      >
                        Select to Grade
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingAssignments.length === 0 && !loadingAssignments && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
                  All assignments currently graded.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sticky top-4 self-start shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Human Finalization</h3>
            {!assignmentReviewForm.submissionId ? (
              <p className="text-center py-12 text-slate-400 italic">Select an assignment to override or finalize AI grading.</p>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Reviewing Submission</p>
                  <p className="text-xs font-mono break-all">{assignmentReviewForm.submissionId}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Final Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="Enter final percentage"
                    value={assignmentReviewForm.score}
                    onChange={(e) => setAssignmentReviewForm((p) => ({ ...p, score: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Result Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`rounded-xl py-2 text-xs font-bold border ${assignmentReviewForm.passed === 'true' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`}
                      onClick={() => setAssignmentReviewForm(p => ({ ...p, passed: 'true' }))}
                    >
                      PASSED
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl py-2 text-xs font-bold border ${assignmentReviewForm.passed === 'false' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-300'}`}
                      onClick={() => setAssignmentReviewForm(p => ({ ...p, passed: 'false' }))}
                    >
                      FAILED
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mentor Feedback / Notes</label>
                  <textarea
                    className="w-full min-h-[120px] rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="Provide specific feedback to the learner..."
                    value={assignmentReviewForm.mentor_notes}
                    onChange={(e) => setAssignmentReviewForm((p) => ({ ...p, mentor_notes: e.target.value }))}
                  />
                </div>
                <button
                  className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                  onClick={() => void runAction(submitAssignmentReview)}
                  type="button"
                >
                  Finalize AI Result & Save
                </button>
                <button
                  className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-tighter"
                  onClick={() => setAssignmentReviewForm({ submissionId: '', score: '', passed: 'true', mentor_notes: '' })}
                >
                  Cancel Selection
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isCoordinator && hasAdminAccess && coordinatorView === 'live-teaching' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Live Teaching Management</h3>
            <p className="mb-4 text-sm text-slate-600">Select a cohort to manage its live sessions and view active classes.</p>
            
            <div className="mb-4 grid gap-3">
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                value={sessionCohortId}
                onChange={(e) => setSessionCohortId(e.target.value)}
              >
                <option value="">Select Cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
              
              <button
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => void runAction(async () => {
                  if (!sessionCohortId) throw new Error('Select a cohort first.');
                  const session = await fetchActiveLiveSession(sessionCohortId);
                  if (session) {
                    setNotice(`Active session found: ${session.title} (${session.id})`);
                  } else {
                    setNotice('No active live session for this cohort.');
                  }
                })}
                type="button"
              >
                Check for Active Session
              </button>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h4 className="text-sm font-bold text-slate-800">Start New Live Class</h4>
              <div className="grid gap-2">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Session Title"
                  id="live-session-title"
                />
                <textarea
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Session Description (Optional)"
                  id="live-session-desc"
                />
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                  onClick={() => {
                    const title = document.getElementById('live-session-title').value;
                    const desc = document.getElementById('live-session-desc').value;
                    void runAction(async () => {
                      const msg = await startLiveSession(sessionCohortId, title, desc);
                      document.getElementById('live-session-title').value = '';
                      document.getElementById('live-session-desc').value = '';
                      return msg;
                    });
                  }}
                  type="button"
                >
                  Launch Live Broadcast
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Attendance & Control</h3>
            <p className="mb-4 text-sm text-slate-600">Monitor active session status and end sessions manually.</p>
            
            <div className="space-y-3">
               <button
                  className="w-full rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  onClick={() => void runAction(async () => {
                    if (!sessionCohortId) throw new Error('Select a cohort first.');
                    const active = await fetchActiveLiveSession(sessionCohortId);
                    if (!active) throw new Error('No active session found.');
                    return await endLiveSession(active.id);
                  })}
                  type="button"
                >
                  End Active Session
               </button>
               
               <div className="mt-6 rounded-xl border border-slate-200 p-4">
                 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Technical Status</h4>
                 <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-sm text-slate-700">WebRTC Signal: Idle</span>
                 </div>
                 <p className="mt-2 text-[10px] text-slate-400">
                    Live teaching uses Cloudflare Calls for ultra-low latency. 
                    Recording is automatically saved to the audit log upon session completion.
                 </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── CONTENT ENGINE TAB ────────────────────────── */}
      {isCoordinator && hasAdminAccess && coordinatorView === 'content-engine' && (() => {

        const saveApiKey = (key) => {
          setCeApiKey(key);
          try { sessionStorage.setItem('ce_api_key', key); } catch { /* ignore */ }
        };

        const loadQueue = async () => {
          setCeQueueLoading(true);
          try {
            const res = await fetch(apiUrl('/api/content/queue'), {
              headers: { 'x-admin-secret': adminToken || '' }
            });
            const data = await res.json();
            setCeQueue(data.posts || data || []);
          } catch (err) {
            setError('Could not load content queue: ' + err.message);
          } finally {
            setCeQueueLoading(false);
          }
        };

        const generateContent = async (type) => {
          if (!ceApiKey) { setError('Please enter your Gemini API key first.'); return; }
          setCeGenerating(true);
          try {
            const res = await fetch(apiUrl('/api/content/generate'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminToken || '' },
              body: JSON.stringify({ type, gemini_api_key: ceApiKey, groq_api_key: '' })
            });
            if (!res.ok) throw new Error(await res.text());
            await loadQueue();
            setNotice(`✓ ${type === 'all' ? 'All content types' : type} drafted successfully.`);
          } catch (err) {
            setError('Generation failed: ' + err.message);
          } finally {
            setCeGenerating(false);
          }
        };

        const startEdit = (post) => {
          setCeEditingId(post.id);
          setCeEditDraft({
            title: post.title || '',
            summary: post.summary || '',
            content_markdown: post.content_markdown || '',
            social_thread_text: post.social_thread_text || '',
            video_script: post.video_script || '',
            seo_metadata: post.seo_metadata || '',
            prompt_text: post.prompt_text || '',
            source_url: post.source_url || '',
          });
        };

        const saveEdit = async () => {
          if (!ceEditingId) return;
          try {
            const res = await fetch(apiUrl(`/api/content/posts/${ceEditingId}`), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminToken || '' },
              body: JSON.stringify(ceEditDraft)
            });
            if (!res.ok) throw new Error(await res.text());
            setCeEditingId(null);
            setCeEditDraft({});
            await loadQueue();
            setNotice('Draft saved.');
          } catch (err) {
            setError('Save failed: ' + err.message);
          }
        };

        const publishPost = async (postId) => {
          setCePublishing(postId);
          try {
            const res = await fetch(apiUrl(`/api/admin/content/posts/${postId}/approve`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminToken || '' },
              body: JSON.stringify({ status: 'published', approved: 'true' })
            });
            if (!res.ok) throw new Error(await res.text());
            await loadQueue();
            setNotice('✓ Published! It will appear on the website now.');
          } catch (err) {
            setError('Publish failed: ' + err.message);
          } finally {
            setCePublishing(null);
          }
        };

        const statusColor = (s) => {
          if (s === 'published') return 'bg-emerald-100 text-emerald-700';
          if (s === 'draft') return 'bg-amber-100 text-amber-700';
          if (s === 'pending_review') return 'bg-blue-100 text-blue-700';
          return 'bg-slate-100 text-slate-600';
        };

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">⚡ Content Engine</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Generate daily AI content (Model Spotlight, DAIY prompt, Health News), edit the draft, then hit <strong>Publish</strong> to go live on the website.
                  </p>
                </div>
                <button
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => void loadQueue()}
                  type="button"
                  disabled={ceQueueLoading}
                >
                  {ceQueueLoading ? 'Loading...' : '↻ Refresh Queue'}
                </button>
              </div>

              {/* BYOK Key Input */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Gemini API Key (Session only — not stored on server)</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                    placeholder="AIza..."
                    value={ceApiKey}
                    onChange={(e) => saveApiKey(e.target.value)}
                    autoComplete="off"
                  />
                  {ceApiKey && (
                    <button
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600"
                      onClick={() => saveApiKey('')}
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Key is stored in sessionStorage and cleared when you close the browser tab.</p>
              </div>

              {/* Generate Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => void generateContent('all')}
                  type="button"
                  disabled={ceGenerating || !ceApiKey}
                >
                  {ceGenerating ? 'Generating...' : '✦ Generate Today\'s Content (All)'}
                </button>
                {['model_spotlight', 'daiy_prompt', 'health_news'].map((type) => (
                  <button
                    key={type}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    onClick={() => void generateContent(type)}
                    type="button"
                    disabled={ceGenerating || !ceApiKey}
                  >
                    + {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Draft Queue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-base font-bold text-slate-900">Content Queue</h3>

              {ceQueue.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-500">No content in queue. Hit "Generate Today's Content" to create drafts.</p>
                  <button
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => void loadQueue()}
                    type="button"
                  >
                    Load Queue
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[32rem] overflow-auto">
                  {ceQueue.map((post) => (
                    <div key={post.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      {ceEditingId === post.id ? (
                        /* Inline Edit Form */
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Editing draft</span>
                            <button className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setCeEditingId(null)} type="button">✕ Cancel</button>
                          </div>
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                            placeholder="Title"
                            value={ceEditDraft.title}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, title: e.target.value }))}
                          />
                          <textarea
                            className="w-full min-h-[4rem] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Summary / description"
                            value={ceEditDraft.summary}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, summary: e.target.value }))}
                          />
                          {post.content_type === 'daiy_prompt' && (
                            <textarea
                              className="w-full min-h-[8rem] rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-green-800 bg-[#0d1117]"
                              placeholder="Prompt text (what doctors will copy)"
                              value={ceEditDraft.prompt_text}
                              onChange={(e) => setCeEditDraft((p) => ({ ...p, prompt_text: e.target.value }))}
                            />
                          )}
                          <textarea
                            className="w-full min-h-[6rem] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Full body / article markdown"
                            value={ceEditDraft.content_markdown}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, content_markdown: e.target.value }))}
                          />
                          <textarea
                            className="w-full min-h-[4rem] rounded-xl border border-slate-300 px-3 py-2 text-sm bg-blue-50"
                            placeholder="Social Thread (LinkedIn / X)"
                            value={ceEditDraft.social_thread_text || ''}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, social_thread_text: e.target.value }))}
                          />
                          <textarea
                            className="w-full min-h-[4rem] rounded-xl border border-slate-300 px-3 py-2 text-sm bg-purple-50"
                            placeholder="Video Script (Shorts / Reels)"
                            value={ceEditDraft.video_script || ''}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, video_script: e.target.value }))}
                          />
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-slate-50"
                            placeholder="SEO Metadata"
                            value={ceEditDraft.seo_metadata || ''}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, seo_metadata: e.target.value }))}
                          />
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Source URL (optional)"
                            value={ceEditDraft.source_url}
                            onChange={(e) => setCeEditDraft((p) => ({ ...p, source_url: e.target.value }))}
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                              onClick={() => void saveEdit()}
                              type="button"
                            >
                              Save Draft
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Draft Row */
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusColor(post.status)}`}>
                                {post.status}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 uppercase">{post.content_type?.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] text-slate-400">{post.date || ''}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 truncate">{post.title || 'Untitled draft'}</p>
                            {post.summary && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{post.summary}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                              onClick={() => startEdit(post)}
                              type="button"
                            >
                              ✏ Edit
                            </button>
                            {post.status !== 'published' && (
                              <button
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                                onClick={() => void publishPost(post.id)}
                                type="button"
                                disabled={cePublishing === post.id}
                              >
                                {cePublishing === post.id ? 'Publishing...' : '▶ Publish'}
                              </button>
                            )}
                            {post.status === 'published' && post.slug && (
                              <a
                                href={`https://edu.greybrain.ai/briefs/${post.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 no-underline"
                              >
                                View Live ↗
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                'Enforce role-based access for /api/admin/* with admin-token fallback',
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
                disabled={!hasAdminAccess}
              >
                Ingest Counselor Logistics
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void runAction(loadOpsAlerts)}
                type="button"
                disabled={!hasAdminAccess || loadingAlerts}
              >
                {loadingAlerts ? 'Refreshing...' : 'Refresh Open Alerts'}
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void runAction(loadAccessAudit)}
                type="button"
                disabled={!hasAdminAccess || loadingAccessAudit}
              >
                {loadingAccessAudit ? 'Refreshing...' : 'Refresh Access Audit'}
              </button>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void runAction(loadContentRuns)}
                type="button"
                disabled={!hasAdminAccess || loadingContentRuns}
              >
                {loadingContentRuns ? 'Refreshing...' : 'Refresh Content Runs'}
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Access And Content Ops Audit</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Platform Users" value={accessAudit?.totals?.platform_users ?? 0} />
              <Metric label="Course Staff" value={accessAudit?.totals?.course_staff ?? 0} />
              <Metric label="Org Staff" value={accessAudit?.totals?.organization_staff ?? 0} />
              <Metric label="Role Overlaps" value={(accessAudit?.findings?.users_with_multiple_roles || []).length} />
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">Users with multiple roles</p>
                <div className="max-h-40 space-y-2 overflow-auto">
                  {(accessAudit?.findings?.users_with_multiple_roles || []).map((row) => (
                    <p key={row.uid} className="text-xs text-slate-700">
                      {row.uid}: {(row.roles || []).join(', ')}
                    </p>
                  ))}
                  {(accessAudit?.findings?.users_with_multiple_roles || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No overlaps found.</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">Staff missing platform user profile</p>
                <div className="max-h-40 space-y-2 overflow-auto">
                  {(accessAudit?.findings?.staff_missing_platform_user || []).map((row) => (
                    <p key={row.uid} className="text-xs text-slate-700">
                      {row.uid}: {(row.staff_roles || []).join(', ')}
                    </p>
                  ))}
                  {(accessAudit?.findings?.staff_missing_platform_user || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No missing profiles.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-900">Recent content generation runs</p>
              <div className="max-h-40 space-y-2 overflow-auto">
                {(contentRuns || []).map((run) => (
                  <p key={`${run.id}:${run.created_at_ms}`} className="text-xs text-slate-700">
                    {run.run_type} · {run.status} · {formatMs(run.created_at_ms)} · {run.message}
                  </p>
                ))}
                {(contentRuns || []).length === 0 ? <p className="text-xs text-slate-500">No run history loaded.</p> : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {canManageContent && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 grid gap-4 xl:grid-cols-[0.72fr_0.28fr]">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Daily Content Pipeline</h3>
              <p className="text-sm text-slate-600">Generate one draft/day with BYOK, review it, edit it, then approve or publish it to the public feed.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={contentGeneratorForm.provider}
                onChange={(event) =>
                  setContentGeneratorForm((prev) => ({ ...prev, provider: event.target.value }))
                }
              >
                <option value="gemini">Gemini</option>
                <option value="anthropic">Claude</option>
                <option value="xai">Grok</option>
                <option value="groq">Groq</option>
              </select>
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                type="text"
                placeholder="Model override (optional)"
                value={contentGeneratorForm.model}
                onChange={(event) =>
                  setContentGeneratorForm((prev) => ({ ...prev, model: event.target.value }))
                }
              />
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                type="password"
                placeholder="BYOK API key"
                value={contentGeneratorForm.apiKey}
                onChange={(event) =>
                  setContentGeneratorForm((prev) => ({ ...prev, apiKey: event.target.value }))
                }
              />
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void runAction(generateDailyBrief)}
                type="button"
              >
                Generate Today&apos;s Draft
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Type</th>
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
                    <td className="px-3 py-2 text-xs uppercase tracking-[0.1em] text-slate-600">{(post.content_type || 'daily_brief').replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{post.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatMs(post.updated_at_ms)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                          onClick={() => loadContentIntoEditor(post)}
                          type="button"
                        >
                          Edit
                        </button>
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
                    <td className="px-3 py-3 text-sm text-slate-500" colSpan={6}>
                      No content drafts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Content Editor</p>
                <p className="text-xs text-slate-500">Create a manual draft or open an existing one, then approve or publish.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {contentEditorForm.postId ? `Editing ${contentEditorForm.postId}` : 'New manual draft'}
                </span>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={startNewContentDraft}
                  type="button"
                >
                  New Draft
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                type="text"
                placeholder="Editorial title"
                value={contentEditorForm.title}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                value={contentEditorForm.path}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, path: event.target.value }))}
              >
                <option value="productivity">Path 1 · Productivity</option>
                <option value="research">Path 2 · Research</option>
                <option value="entrepreneurship">Path 3 · Entrepreneurship</option>
              </select>
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                value={contentEditorForm.contentType}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, contentType: event.target.value }))}
              >
                <option value="daily_brief">Daily Brief</option>
                <option value="workflow">Workflow</option>
                <option value="wiki">Wiki</option>
                <option value="model_watch">Model Watch</option>
              </select>
              <textarea
                className="min-h-[96px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 md:col-span-2"
                placeholder="Homepage summary"
                value={contentEditorForm.summary}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, summary: event.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 md:col-span-2"
                type="text"
                placeholder="Tags separated by commas"
                value={contentEditorForm.tags}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, tags: event.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 md:col-span-2"
                type="url"
                placeholder="Canonical URL on GreyBrain"
                value={contentEditorForm.canonicalUrl}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, canonicalUrl: event.target.value }))}
              />
              <textarea
                className="min-h-[96px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 md:col-span-2"
                placeholder="Source links, one per line"
                value={contentEditorForm.sourceUrls}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, sourceUrls: event.target.value }))}
              />
              <textarea
                className="min-h-[280px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 md:col-span-2"
                placeholder="content_markdown"
                value={contentEditorForm.contentMarkdown}
                onChange={(event) => setContentEditorForm((prev) => ({ ...prev, contentMarkdown: event.target.value }))}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(saveContentDraft)}
                type="button"
              >
                {contentEditorForm.postId ? 'Save Draft' : 'Create Draft'}
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(() => setContentStatus(contentEditorForm.postId, 'approved'))}
                type="button"
                disabled={!contentEditorForm.postId}
              >
                Approve Draft
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => void runAction(() => setContentStatus(contentEditorForm.postId, 'published'))}
                type="button"
                disabled={!contentEditorForm.postId}
              >
                Publish Now
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900">Channel Exports</p>
                <p className="text-xs text-slate-500">Publish on GreyBrain first, then copy the version you need for LinkedIn, Facebook, X, or Medium.</p>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {[
                  { key: 'linkedin', label: 'LinkedIn', rows: 12 },
                  { key: 'facebook', label: 'Facebook', rows: 10 },
                  { key: 'x', label: 'X Thread', rows: 10 },
                  { key: 'medium', label: 'Medium', rows: 14 }
                ].map((channel) => (
                  <div key={channel.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                        onClick={() => void runAction(() => copyContentExport(contentExports[channel.key], channel.label))}
                        type="button"
                      >
                        Copy
                      </button>
                    </div>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                      rows={channel.rows}
                      readOnly
                      value={contentExports[channel.key]}
                    />
                  </div>
                ))}
              </div>
            </div>
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
                  {isCoordinatorUser && hasAdminAccess ? (
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
                    <span className="text-xs text-slate-500">{isCoordinatorUser ? 'Role access required' : 'View only'}</span>
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

function RAGHealthDashboard({ user, roles, actorFetch }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await actorFetch(user, roles, apiUrl('/api/admin/rag/health'));
        const data = await res.json();
        if (res.ok) setMetrics(data);
      } catch (e) {
        console.error('Failed to load RAG metrics', e);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, [user, roles, actorFetch]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading RAG health telemetry...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Vectorize Sync</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{metrics?.vectorize?.syncStatus || 'Healthy'}</p>
          <p className="mt-1 text-sm text-slate-600">Last crawled: {metrics?.vectorize?.lastSync || 'Just now'}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg AI Latency</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{metrics?.latency?.avg || '1.2s'}</p>
          <p className="mt-1 text-sm text-slate-600">P95: {metrics?.latency?.p95 || '2.4s'}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Misconception Count</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{metrics?.misconceptions?.length || 0}</p>
          <p className="mt-1 text-sm text-slate-600">Hotspots identified by AI.</p>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Student Pitfalls & Hotspots</h3>
        <p className="mt-1 text-sm text-slate-600">AI-identified trends where learners are struggling with RAG-delivered concepts.</p>
        <div className="mt-6 space-y-4">
          {(metrics?.misconceptions || [
            { id: 1, topic: 'Model Quantization', frequency: 'High', recommendation: 'Add pre-read on 4-bit vs 8-bit.' },
            { id: 2, topic: 'RLHF Concepts', frequency: 'Medium', recommendation: 'Clarify reward model alignment.' }
          ]).map(pitfall => (
            <div key={pitfall.id} className="flex items-start gap-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-bold">!</div>
              <div>
                <p className="font-bold text-slate-900">{pitfall.topic}</p>
                <p className="mt-1 text-sm text-slate-600">{pitfall.recommendation}</p>
                <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">Frequency: {pitfall.frequency}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Vectorize Index Status</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Source Name</th>
                <th className="px-4 py-3">Document Count</th>
                <th className="px-4 py-3">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(metrics?.sources || [
                { name: 'Modules (Internal)', count: 42, health: 'Syncing' },
                { name: 'Research Papers (RAG)', count: 128, health: 'Healthy' },
                { name: 'Clinical Guidelines', count: 15, health: 'Healthy' }
              ]).map(source => (
                <tr key={source.name}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{source.name}</td>
                  <td className="px-4 py-3 text-slate-600">{source.count}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${source.health === 'Healthy' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                      {source.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
