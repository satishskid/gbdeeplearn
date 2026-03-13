import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { apiUrl } from '../lib/api';
import { getSessionId } from '../lib/experiments';
import { auth, db, persistenceReady } from '../lib/firebase';

const STORAGE_KEY = 'greybrain:ai-refresher:v1';
const TRACK_ENDPOINT = apiUrl('/api/track');
const COURSE_SLUG = 'ai-refresher-for-doctors';
const WEBINAR_ID = 'ai-refresher-for-doctors';

const CHAPTERS = [
  {
    id: 'chapter-1',
    title: 'Chapter 1: Prompt to answer',
    mode: 'interactive',
    summary: 'See how instruction quality changes output quality in a doctor-facing task.'
  },
  {
    id: 'chapter-2',
    title: 'Chapter 2: Why context matters',
    mode: 'interactive',
    summary: 'Compare generic answers with grounded answers based on source context.'
  },
  {
    id: 'chapter-3',
    title: 'Chapter 3: How models work without the jargon',
    mode: 'interactive',
    summary: 'Learn the minimum truthful model: tokens, prediction, temperature, and why fluent output is not judgment.'
  },
  {
    id: 'chapter-4',
    title: 'Chapter 4: Why review still matters',
    mode: 'interactive',
    summary: 'Understand how confident-sounding answers can still carry risk, omission, or overreach.'
  },
  {
    id: 'chapter-5',
    title: 'Chapter 5: What good outputs look like',
    mode: 'interactive',
    summary: 'Compare practice, publish, and build outputs so AI value maps to a workflow, not novelty.'
  },
  {
    id: 'chapter-6',
    title: 'Chapter 6: Choose your GreyBrain path',
    mode: 'checkpoint',
    summary: 'Use the refresher as a sorting layer into the cohort that fits your next outcome.'
  }
];

const PATHS = {
  productivity: {
    label: 'Practice',
    title: 'Clinical AI Practitioner',
    href: '/tracks/clinical-ai-practitioner',
    summary: 'Best if your next goal is documentation, patient communication, and workflow support in daily clinical care.',
    accentClass: 'border-teal-200 bg-teal-50 text-teal-900'
  },
  research: {
    label: 'Publish',
    title: 'AI Research Accelerator',
    href: '/tracks/ai-research-accelerator',
    summary: 'Best if your next goal is literature review, study design translation, writing, and publication readiness.',
    accentClass: 'border-blue-200 bg-blue-50 text-blue-900'
  },
  entrepreneurship: {
    label: 'Build',
    title: 'Doctor AI Entrepreneurship',
    href: '/tracks/doctor-ai-entrepreneurship',
    summary: 'Best if your next goal is problem validation, MVP thinking, pilots, and venture-building.',
    accentClass: 'border-amber-200 bg-amber-50 text-amber-900'
  }
};

const TEMPERATURE_PRESETS = [
  {
    id: 'low',
    label: 'Low temperature',
    range: [0, 39],
    output:
      'Patient has been discharged in stable condition. Continue medicines as prescribed, attend scheduled follow-up, and return early if symptoms worsen.',
    note: 'More stable and predictable. Better for patient communication and structured summaries.'
  },
  {
    id: 'medium',
    label: 'Balanced temperature',
    range: [40, 79],
    output:
      'Your family member is well enough to go home, but follow-up is still important. Continue the listed medicines, watch for fever or breathlessness, and bring the discharge papers to the review visit.',
    note: 'Balanced between clarity and natural language. Often useful for doctor-facing drafts.'
  },
  {
    id: 'high',
    label: 'High temperature',
    range: [80, 120],
    output:
      'This discharge marks a transition point in recovery. Build a family-ready recovery checklist, track warning signs closely, and prepare a clear narrative for the next clinical handoff.',
    note: 'More varied and idea-oriented, but easier to overstate or drift from the exact task.'
  }
];

const RISK_OPTIONS = [
  {
    id: 'unsupported',
    label: 'Unsupported claim',
    correct: true
  },
  {
    id: 'missing-caution',
    label: 'Missing caution',
    correct: true
  },
  {
    id: 'overconfident',
    label: 'Overconfident wording',
    correct: true
  },
  {
    id: 'short',
    label: 'Too short',
    correct: false
  }
];

const OUTPUT_LANES = {
  productivity: {
    label: 'Practice',
    title: 'Clinic note to patient instructions',
    output:
      '1. Continue the prescribed medicines exactly as written.\n2. Watch for fever, breathlessness, or reduced urine output.\n3. Book the follow-up visit within 7 days.\n\nFamily version: these are the three things to monitor at home.',
    note: 'Best when the next task is clearer communication or workflow support.'
  },
  research: {
    label: 'Publish',
    title: 'Paper to poster outline',
    output:
      'Background: why the question matters.\nMethods: population, protocol, and primary endpoint.\nResults: three quantitative findings.\nDiscussion: clinical relevance, limitations, and one next-step study question.',
    note: 'Best when the next task is synthesis, writing, or academic presentation.'
  },
  entrepreneurship: {
    label: 'Build',
    title: 'Clinical pain point to MVP brief',
    output:
      'Problem: discharge communication breaks after the patient leaves.\nUser: resident, consultant, and family caregiver.\nMVP: structured discharge assistant with review step.\nPilot metric: reduction in follow-up clarification calls within 30 days.',
    note: 'Best when the next task is service design, pilot thinking, or venture building.'
  }
};

const CONTEXT_MODES = {
  none: {
    label: 'No context',
    answer:
      'This looks like a clinical trial. I would review the paper carefully, check who was included, and interpret the findings before applying them.',
    note: 'Generic and cautious, but not grounded enough to be actionable.'
  },
  source: {
    label: 'One source attached',
    answer:
      'The attached protocol states that adults aged 18 to 65 with confirmed type 2 diabetes and HbA1c between 7.5% and 10% were included, while pregnancy and severe renal disease were excluded.',
    note: 'The answer becomes more specific because one protocol source is now available.'
  },
  syllabus: {
    label: 'Protocol + GreyBrain syllabus context',
    answer:
      'The answer is now grounded in both the trial protocol and the workflow objective: extract inclusion criteria, identify exclusion risks, and prepare a structured note on external validity before applying the result to practice.',
    note: 'Context turns generic output into a workflow-ready response.'
  }
};

function loadStoredState() {
  if (typeof window === 'undefined') {
    return {
      completed: [],
      chapterTwoVisited: ['none'],
      recommendation: ''
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        completed: [],
        chapterTwoVisited: ['none'],
        chapterThreeVisited: [],
        selectedRisks: [],
        viewedOutputLanes: [],
        recommendation: ''
      };
    }
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
      chapterTwoVisited: Array.isArray(parsed?.chapterTwoVisited) ? parsed.chapterTwoVisited : ['none'],
      chapterThreeVisited: Array.isArray(parsed?.chapterThreeVisited) ? parsed.chapterThreeVisited : [],
      selectedRisks: Array.isArray(parsed?.selectedRisks) ? parsed.selectedRisks : [],
      viewedOutputLanes: Array.isArray(parsed?.viewedOutputLanes) ? parsed.viewedOutputLanes : [],
      recommendation: typeof parsed?.recommendation === 'string' ? parsed.recommendation : ''
    };
  } catch {
    return {
      completed: [],
      chapterTwoVisited: ['none'],
      chapterThreeVisited: [],
      selectedRisks: [],
      viewedOutputLanes: [],
      recommendation: ''
    };
  }
}

function persistState(nextState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function uniqueList(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function buildEnhancedPrompt({ promptText, useRole, useTask, useFormat }) {
  const lines = [];
  if (useRole) lines.push('You are a physician communication assistant.');
  lines.push(promptText.trim() || 'Explain this discharge summary.');
  if (useTask) lines.push('Task: Convert the note into a safe, plain-language explanation for a patient family.');
  if (useFormat) lines.push('Format: 3 bullet points, 2 follow-up actions, 1 caution to review with the treating doctor.');
  return lines.join('\n');
}

function getRecommendation(outcome, stage) {
  const path = PATHS[outcome] || PATHS.productivity;
  const stageLine =
    stage === 'beginner'
      ? 'You are still orienting. Start with the path that gives the fastest visible win.'
      : stage === 'experimenting'
        ? 'You already have some AI exposure. Move into a cohort that adds structure and mentor review.'
        : 'You are ready to implement. Use the cohort to build reusable workflows and capstone-quality outputs.';

  return {
    ...path,
    stageLine
  };
}

export default function RefresherInteractiveExperience() {
  const sessionId = useMemo(() => getSessionId(), []);
  const syncedUserRef = useRef('');
  const previousCompletedRef = useRef([]);
  const previousRecommendationRef = useRef('');
  const progressSnapshotRef = useRef({
    completed: [],
    chapterTwoVisited: ['none'],
    chapterThreeVisited: [],
    selectedRisks: [],
    viewedOutputLanes: [],
    recommendation: ''
  });
  const [hydrated, setHydrated] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [chapterTwoVisited, setChapterTwoVisited] = useState(['none']);
  const [chapterThreeVisited, setChapterThreeVisited] = useState([]);
  const [selectedRisks, setSelectedRisks] = useState([]);
  const [viewedOutputLanes, setViewedOutputLanes] = useState([]);
  const [storedRecommendation, setStoredRecommendation] = useState('');
  const [userId, setUserId] = useState('');
  const [syncStatus, setSyncStatus] = useState('local');

  const [promptText, setPromptText] = useState(
    'Summarize this discharge summary for the patient family.'
  );
  const [useRole, setUseRole] = useState(false);
  const [useTask, setUseTask] = useState(false);
  const [useFormat, setUseFormat] = useState(false);
  const [contextMode, setContextMode] = useState('none');
  const [temperature, setTemperature] = useState(55);
  const [goal, setGoal] = useState('productivity');
  const [stage, setStage] = useState('beginner');
  const [activeOutputLane, setActiveOutputLane] = useState('productivity');

  useEffect(() => {
    const stored = loadStoredState();
    setCompleted(stored.completed);
    setChapterTwoVisited(stored.chapterTwoVisited);
    setChapterThreeVisited(stored.chapterThreeVisited);
    setSelectedRisks(stored.selectedRisks);
    setViewedOutputLanes(stored.viewedOutputLanes);
    setStoredRecommendation(stored.recommendation);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState({
      completed,
      chapterTwoVisited,
      chapterThreeVisited,
      selectedRisks,
      viewedOutputLanes,
      recommendation: storedRecommendation
    });
  }, [completed, chapterTwoVisited, chapterThreeVisited, hydrated, selectedRisks, storedRecommendation, viewedOutputLanes]);

  useEffect(() => {
    progressSnapshotRef.current = {
      completed,
      chapterTwoVisited,
      chapterThreeVisited,
      selectedRisks,
      viewedOutputLanes,
      recommendation: storedRecommendation
    };
  }, [chapterThreeVisited, chapterTwoVisited, completed, selectedRisks, storedRecommendation, viewedOutputLanes]);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setUserId(user?.uid || '');
      if (!user) {
        setSyncStatus('local');
        syncedUserRef.current = '';
        return;
      }

      setSyncStatus('syncing');
      await persistenceReady.catch(() => {});

      try {
        const progressRef = doc(db, 'users', user.uid, 'learning_progress', COURSE_SLUG);
        const snapshot = await getDoc(progressRef);
        if (!active) return;

        if (snapshot.exists()) {
          const remote = snapshot.data() || {};
          const local = progressSnapshotRef.current;
          const mergedCompleted = uniqueList([...(remote.completed || []), ...(local.completed || [])]);
          const mergedChapterTwo = uniqueList([...(remote.chapterTwoVisited || []), ...(local.chapterTwoVisited || [])]);
          const mergedChapterThree = uniqueList([...(remote.chapterThreeVisited || []), ...(local.chapterThreeVisited || [])]);
          const mergedRisks = uniqueList([...(remote.selectedRisks || []), ...(local.selectedRisks || [])]);
          const mergedLanes = uniqueList([...(remote.viewedOutputLanes || []), ...(local.viewedOutputLanes || [])]);
          const mergedRecommendation = String(remote.recommendation || local.recommendation || '').trim();

          setCompleted(mergedCompleted);
          setChapterTwoVisited(mergedChapterTwo.length > 0 ? mergedChapterTwo : ['none']);
          setChapterThreeVisited(mergedChapterThree);
          setSelectedRisks(mergedRisks);
          setViewedOutputLanes(mergedLanes);
          setStoredRecommendation(mergedRecommendation);
          persistState({
            completed: mergedCompleted,
            chapterTwoVisited: mergedChapterTwo.length > 0 ? mergedChapterTwo : ['none'],
            chapterThreeVisited: mergedChapterThree,
            selectedRisks: mergedRisks,
            viewedOutputLanes: mergedLanes,
            recommendation: mergedRecommendation
          });
        }

        syncedUserRef.current = user.uid;
        setSyncStatus('synced');
      } catch {
        if (!active) return;
        setSyncStatus('local');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !userId || syncedUserRef.current !== userId) return;

    const sync = async () => {
      try {
        setSyncStatus('syncing');
        const progressRef = doc(db, 'users', userId, 'learning_progress', COURSE_SLUG);
        await setDoc(
          progressRef,
          {
            course_slug: COURSE_SLUG,
            completed,
            chapterTwoVisited,
            chapterThreeVisited,
            selectedRisks,
            viewedOutputLanes,
            recommendation: storedRecommendation,
            session_id: sessionId,
            updated_at: serverTimestamp()
          },
          { merge: true }
        );
        setSyncStatus('synced');
      } catch {
        setSyncStatus('local');
      }
    };

    void sync();
  }, [
    chapterThreeVisited,
    chapterTwoVisited,
    completed,
    hydrated,
    selectedRisks,
    sessionId,
    storedRecommendation,
    userId,
    viewedOutputLanes
  ]);

  useEffect(() => {
    const chapterOneReady = [useRole, useTask, useFormat].filter(Boolean).length >= 2;
    if (chapterOneReady && !completed.includes('chapter-1')) {
      setCompleted((prev) => [...prev, 'chapter-1']);
    }
  }, [useRole, useTask, useFormat, completed]);

  useEffect(() => {
    if (!chapterTwoVisited.includes(contextMode)) {
      setChapterTwoVisited((prev) => [...prev, contextMode]);
    }
  }, [contextMode, chapterTwoVisited]);

  useEffect(() => {
    const chapterTwoReady = ['none', 'source', 'syllabus'].every((mode) => chapterTwoVisited.includes(mode));
    if (chapterTwoReady && !completed.includes('chapter-2')) {
      setCompleted((prev) => [...prev, 'chapter-2']);
    }
  }, [chapterTwoVisited, completed]);

  useEffect(() => {
    const currentTier = TEMPERATURE_PRESETS.find((item) => temperature >= item.range[0] && temperature <= item.range[1])?.id || 'medium';
    if (!chapterThreeVisited.includes(currentTier)) {
      setChapterThreeVisited((prev) => [...prev, currentTier]);
    }
  }, [temperature, chapterThreeVisited]);

  useEffect(() => {
    const chapterThreeReady = ['low', 'medium', 'high'].every((tier) => chapterThreeVisited.includes(tier));
    if (chapterThreeReady && !completed.includes('chapter-3')) {
      setCompleted((prev) => [...prev, 'chapter-3']);
    }
  }, [chapterThreeVisited, completed]);

  useEffect(() => {
    const correctRiskIds = RISK_OPTIONS.filter((item) => item.correct).map((item) => item.id);
    const hasAllCorrect = correctRiskIds.every((id) => selectedRisks.includes(id));
    const hasIncorrect = selectedRisks.some((id) => !correctRiskIds.includes(id));
    if (hasAllCorrect && !hasIncorrect && !completed.includes('chapter-4')) {
      setCompleted((prev) => [...prev, 'chapter-4']);
    }
  }, [selectedRisks, completed]);

  useEffect(() => {
    if (!viewedOutputLanes.includes(activeOutputLane)) {
      setViewedOutputLanes((prev) => [...prev, activeOutputLane]);
    }
  }, [activeOutputLane, viewedOutputLanes]);

  useEffect(() => {
    const chapterFiveReady = ['productivity', 'research', 'entrepreneurship'].every((lane) => viewedOutputLanes.includes(lane));
    if (chapterFiveReady && !completed.includes('chapter-5')) {
      setCompleted((prev) => [...prev, 'chapter-5']);
    }
  }, [viewedOutputLanes, completed]);

  useEffect(() => {
    if (!hydrated) return;

    const previous = previousCompletedRef.current;
    const newCompletions = completed.filter((chapterId) => !previous.includes(chapterId));
    previousCompletedRef.current = completed;

    const postEvents = async () => {
      for (const chapterId of newCompletions) {
        try {
          await fetch(TRACK_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
              event_name: 'refresher_chapter_completed',
              webinar_id: WEBINAR_ID,
              source: 'refresher-course',
              session_id: sessionId,
              lead_id: userId || '',
              path: typeof window !== 'undefined' ? window.location.pathname : `/courses/${COURSE_SLUG}`,
              chapter_id: chapterId
            })
          });
        } catch {
          // Ignore analytics failures in the refresher UX.
        }
      }
    };

    if (newCompletions.length > 0) {
      void postEvents();
    }
  }, [completed, hydrated, sessionId, userId]);

  useEffect(() => {
    if (!hydrated || !storedRecommendation || storedRecommendation === previousRecommendationRef.current) return;
    previousRecommendationRef.current = storedRecommendation;

    const postRecommendation = async () => {
      try {
        await fetch(TRACK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            event_name: 'refresher_path_saved',
            webinar_id: WEBINAR_ID,
            source: 'refresher-course',
            session_id: sessionId,
            lead_id: userId || '',
            path: typeof window !== 'undefined' ? window.location.pathname : `/courses/${COURSE_SLUG}`,
            recommended_path: storedRecommendation
          })
        });
      } catch {
        // Ignore analytics failures in the refresher UX.
      }
    };

    void postRecommendation();
  }, [hydrated, sessionId, storedRecommendation, userId]);

  const enhancedPrompt = useMemo(
    () => buildEnhancedPrompt({ promptText, useRole, useTask, useFormat }),
    [promptText, useRole, useTask, useFormat]
  );
  const activeTemperaturePreset =
    TEMPERATURE_PRESETS.find((item) => temperature >= item.range[0] && temperature <= item.range[1]) || TEMPERATURE_PRESETS[1];
  const prereqComplete = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'].every((chapterId) =>
    completed.includes(chapterId)
  );

  const progressPct = Math.round((completed.length / CHAPTERS.length) * 100);
  const allCompleted = completed.length === CHAPTERS.length;
  const recommendation = getRecommendation(goal, stage);

  const resetProgress = () => {
    setCompleted([]);
    setChapterTwoVisited(['none']);
    setChapterThreeVisited([]);
    setSelectedRisks([]);
    setViewedOutputLanes([]);
    setStoredRecommendation('');
    setUseRole(false);
    setUseTask(false);
    setUseFormat(false);
    setContextMode('none');
    setTemperature(55);
    setActiveOutputLane('productivity');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const saveRecommendation = () => {
    if (!completed.includes('chapter-6')) {
      setCompleted((prev) => [...prev, 'chapter-6']);
    }
    setStoredRecommendation(goal);
  };

  const toggleRisk = (riskId) => {
    setSelectedRisks((prev) =>
      prev.includes(riskId) ? prev.filter((item) => item !== riskId) : [...prev, riskId]
    );
  };

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-xl md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Interactive refresher</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-900 md:text-3xl">Work through all five core chapters, then unlock your path recommendation.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Progress is saved on this device. Chapters 1 to 5 now use interactive comparisons, review exercises, and workflow switches so the recommendation is unlocked through actual exploration.
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Progress</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{completed.length}/{CHAPTERS.length}</p>
          <p className="text-sm text-slate-600">{progressPct}% complete</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {syncStatus === 'synced' ? 'Synced to learner profile' : syncStatus === 'syncing' ? 'Syncing progress' : 'Saved on this device'}
          </p>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-teal-200 bg-teal-50/50 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-teal-700">Chapter 1</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">Prompt to answer</h3>
            </div>
            {completed.includes('chapter-1') ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                Completed
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Start with a weak instruction. Then add role, task, and output format so you can see why better prompts create more usable drafts.
          </p>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            className="mt-4 min-h-[6.5rem] w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-teal-300/30 transition focus:border-teal-400 focus:ring-2"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: 'Add role', active: useRole, onClick: () => setUseRole((prev) => !prev) },
              { label: 'Add task', active: useTask, onClick: () => setUseTask((prev) => !prev) },
              { label: 'Add format', active: useFormat, onClick: () => setUseFormat((prev) => !prev) }
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  item.active
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-teal-200 bg-white text-teal-900 hover:bg-teal-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Weak prompt output</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                This discharge summary explains the patient condition and recommends follow-up. Please review medicines and continue care as advised by the doctor.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Improved prompt output</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                1. Your family member is stable enough to go home, but follow-up is still important.{'\n'}
                2. Continue the prescribed medicines exactly as written in the discharge note.{'\n'}
                3. Contact the treating team early if breathlessness, fever, or new confusion appears.{'\n\n'}
                Next actions: book the follow-up visit, bring the medicine list, and keep the discharge papers available.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">Refined prompt preview</p>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{enhancedPrompt}</pre>
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-blue-200 bg-blue-50/50 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-blue-700">Chapter 2</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">Why context matters</h3>
            </div>
            {completed.includes('chapter-2') ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                Completed
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Ask the same question in three context modes. The goal is to see how grounded context makes answers more specific and more useful.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(CONTEXT_MODES).map(([mode, item]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setContextMode(mode)}
                className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  contextMode === mode
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-blue-200 bg-white text-blue-900 hover:bg-blue-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Question</p>
            <p className="mt-2 text-sm leading-6 text-slate-800">
              Based on this diabetes trial, what should I check before applying it to my patients?
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Answer</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">{CONTEXT_MODES[contextMode].answer}</p>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
              {CONTEXT_MODES[contextMode].note}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">Visited modes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(CONTEXT_MODES).map(([mode, item]) => (
                <span
                  key={mode}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                    chapterTwoVisited.includes(mode) ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <article className="rounded-[1.6rem] border border-violet-200 bg-violet-50/50 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-violet-700">Chapter 3</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">How models work without the jargon</h3>
            </div>
            {completed.includes('chapter-3') ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                Completed
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Move the temperature slider and watch the output style change. The model is predicting token sequences, not applying clinical judgment.
          </p>
          <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Temperature</p>
              <p className="text-sm font-bold text-slate-900">{(temperature / 100).toFixed(2)}</p>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
              className="mt-3 w-full accent-violet-700"
            />
            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 text-sm text-violet-900">
              <p className="font-semibold">{activeTemperaturePreset.label}</p>
              <p className="mt-2 leading-6">{activeTemperaturePreset.output}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">{activeTemperaturePreset.note}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {TEMPERATURE_PRESETS.map((preset) => (
              <span
                key={preset.id}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                  chapterThreeVisited.includes(preset.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500'
                }`}
              >
                {preset.label}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-rose-200 bg-rose-50/50 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-rose-700">Chapter 4</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">Why review still matters</h3>
            </div>
            {completed.includes('chapter-4') ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                Completed
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            This answer sounds polished. Identify the hidden problems before you would allow it into patient or research workflow.
          </p>
          <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Draft to review</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              This study proves the intervention is safe for all adults with diabetes and guarantees better long-term control, so the same protocol can be applied broadly without major exclusion concerns.
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            {RISK_OPTIONS.map((risk) => (
              <button
                key={risk.id}
                type="button"
                onClick={() => toggleRisk(risk.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  selectedRisks.includes(risk.id)
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-rose-200 bg-white text-rose-900 hover:bg-rose-100'
                }`}
              >
                {risk.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 text-sm text-rose-900">
            Correct review lens: the answer overstates certainty, ignores exclusion logic, and makes unsupported safety claims.
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-amber-200 bg-amber-50/50 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-amber-700">Chapter 5</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">What good outputs look like</h3>
            </div>
            {completed.includes('chapter-5') ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                Completed
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Switch between Practice, Publish, and Build to see how the same AI foundations produce different outputs when the workflow changes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(OUTPUT_LANES).map(([key, lane]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveOutputLane(key)}
                className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  activeOutputLane === key
                    ? 'border-amber-700 bg-amber-700 text-white'
                    : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100'
                }`}
              >
                {lane.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{OUTPUT_LANES[activeOutputLane].title}</p>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{OUTPUT_LANES[activeOutputLane].output}</pre>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">{OUTPUT_LANES[activeOutputLane].note}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(OUTPUT_LANES).map(([key, lane]) => (
              <span
                key={key}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                  viewedOutputLanes.includes(key) ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500'
                }`}
              >
                {lane.label}
              </span>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,#0f172a,#162032)] p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Path recommendation</p>
            <h3 className="mt-2 text-2xl font-extrabold">Choose what you want next, then let the refresher route you.</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              The recommendation unlocks after the five core chapters are complete. Chapter 6 is the decision layer: pick the outcome that matters and save the next path.
            </p>
          </div>
          <button
            type="button"
            onClick={resetProgress}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Reset progress
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Outcome that matters most</p>
              <div className="mt-3 grid gap-2">
                {Object.entries(PATHS).map(([value, item]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGoal(value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      goal === value ? 'border-white/30 bg-white text-slate-900' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold">{item.title}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Current stage</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['beginner', 'AI beginner'],
                  ['experimenting', 'Experimenting already'],
                  ['implementing', 'Ready to implement']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStage(value)}
                    className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                      stage === value ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
            {prereqComplete ? (
              <>
                <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${recommendation.accentClass}`}>
                  Recommended next path: {recommendation.label}
                </div>
                <h4 className="mt-3 text-2xl font-extrabold">{recommendation.title}</h4>
                <p className="mt-3 text-sm leading-7 text-slate-200">{recommendation.summary}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{recommendation.stageLine}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={recommendation.href} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                    Explore {recommendation.label} Path
                  </a>
                  <a href="/#enroll" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
                    Start Enrollment
                  </a>
                  <button
                    type="button"
                    onClick={saveRecommendation}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                  >
                    Save Recommendation
                  </button>
                </div>
                {storedRecommendation ? (
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                    Saved on this device: {PATHS[storedRecommendation]?.label || 'Recommendation'}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-sm leading-7 text-slate-200">
                  Finish the five core chapters to unlock the recommendation. Right now {Math.max(0, 5 - completed.filter((chapterId) => chapterId !== 'chapter-6').length)} chapter{Math.max(0, 5 - completed.filter((chapterId) => chapterId !== 'chapter-6').length) === 1 ? '' : 's'} remain.
                </p>
                <div className="mt-4 grid gap-2">
                  {CHAPTERS.filter((chapter) => chapter.id !== 'chapter-6' && !completed.includes(chapter.id)).map((chapter) => (
                    <div key={chapter.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
                      {chapter.title}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
