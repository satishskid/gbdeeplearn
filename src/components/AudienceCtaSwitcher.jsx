import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';
import { getSessionId, markVariantAssigned, resolveCtaVariant } from '../lib/experiments';

const TRACK_ENDPOINT = apiUrl('/api/track');
const WEBINAR_ID = 'deep-rag-live-webinar';
const SINGLE_PRIMARY_FLAG = String(import.meta.env.PUBLIC_HERO_SINGLE_PRIMARY || '1').trim().toLowerCase();
const HERO_SINGLE_PRIMARY_MODE = !['0', 'false', 'no', 'off'].includes(SINGLE_PRIMARY_FLAG);

const PATHS = [
  {
    id: 'doctor',
    tab: 'Practice',
    kicker: 'Path 1',
    title: 'Clinical Productivity',
    headline: 'Reduce documentation and communication load.',
    shortDescription: 'Daily clinical work',
    fitLine: 'Best when you want faster notes, summaries, and patient communication.',
    outcomes: ['Clinical notes and summaries', 'Patient communication', 'Workflow SOP support'],
    transformation: {
      from: 'Raw clinical note',
      to: 'Patient-ready instruction',
      support: 'Tutor + workflow review'
    },
    primaryLabel: 'Explore Clinical Productivity',
    primaryHref: '/tracks/clinical-ai-practitioner',
    visualSrc: '/images/home/practice-path.svg',
    accentClass: 'border-teal-300 bg-teal-50/70 text-teal-900',
    glowClass: 'from-teal-300/35 via-cyan-300/15 to-transparent',
    iconAccentClass: 'text-teal-700'
  },
  {
    id: 'researcher',
    tab: 'Publish',
    kicker: 'Path 2',
    title: 'Research Acceleration',
    headline: 'Accelerate literature, evidence, and manuscripts.',
    shortDescription: 'Research and publishing',
    fitLine: 'Best when you want stronger literature review, synthesis, and reviewer-response work.',
    outcomes: ['Evidence synthesis', 'Study design logic', 'Manuscripts and reviewer responses'],
    transformation: {
      from: 'Paper or protocol',
      to: 'Publication-ready draft',
      support: 'Tutor + mentor critique'
    },
    primaryLabel: 'Explore Research Accelerator',
    primaryHref: '/tracks/ai-research-accelerator',
    visualSrc: '/images/home/research-path.svg',
    accentClass: 'border-blue-300 bg-blue-50/70 text-blue-900',
    glowClass: 'from-blue-300/35 via-sky-300/15 to-transparent',
    iconAccentClass: 'text-blue-700'
  },
  {
    id: 'founder',
    tab: 'Build',
    kicker: 'Path 3',
    title: 'Venture Building',
    headline: 'Turn clinical insight into pilots and venture briefs.',
    shortDescription: 'Products and ventures',
    fitLine: 'Best when you want to validate an idea, frame an MVP, and define pilot metrics.',
    outcomes: ['Problem validation', 'No-code MVP planning', 'Pilot metrics and capstone'],
    transformation: {
      from: 'Clinical pain point',
      to: 'Pilot-ready brief',
      support: 'Tutor + capstone build'
    },
    primaryLabel: 'Explore Venture Builder',
    primaryHref: '/tracks/doctor-ai-entrepreneurship',
    visualSrc: '/images/home/build-path.svg',
    accentClass: 'border-amber-300 bg-amber-50/70 text-amber-900',
    glowClass: 'from-amber-300/35 via-orange-300/15 to-transparent',
    iconAccentClass: 'text-amber-700'
  }
];

function PathGlyph({ id, active }) {
  const stroke = active ? '#0f172a' : 'rgba(241,245,249,0.92)';
  const fill = active ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  if (id === 'doctor') {
    return (
      <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none" aria-hidden="true">
        <rect x="6" y="7" width="28" height="26" rx="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <path d="M20 13v14M13 20h14" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === 'researcher') {
    return (
      <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none" aria-hidden="true">
        <rect x="7" y="7" width="20" height="26" rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <circle cx="28.5" cy="28.5" r="5.5" stroke={stroke} strokeWidth="2" />
        <path d="M32.5 32.5L35 35" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M11.5 14h11M11.5 19h9M11.5 24h7" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none" aria-hidden="true">
      <rect x="7" y="17" width="26" height="16" rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M12 17v-1a8 8 0 0 1 16 0v1" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="25" r="2.5" fill={stroke} />
    </svg>
  );
}

export default function AudienceCtaSwitcher({ enrollTargetId = 'enroll' }) {
  const [activeId, setActiveId] = useState(PATHS[0].id);
  const sessionId = useMemo(() => getSessionId(), []);
  const variant = useMemo(() => resolveCtaVariant(sessionId), [sessionId]);
  const active = PATHS.find((path) => path.id === activeId) || PATHS[0];

  const postEvent = async (eventName, extra = {}) => {
    try {
      await fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          webinar_id: WEBINAR_ID,
          source: 'hero-switcher',
          session_id: sessionId,
          cta_variant: variant,
          path: typeof window !== 'undefined' ? window.location.pathname : '/',
          ...extra
        })
      });
    } catch {
      // Ignore telemetry failure in UX component.
    }
  };

  useEffect(() => {
    if (markVariantAssigned(variant)) {
      void postEvent('cta_variant_assigned', { assigned_variant: variant });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const ctaLabelByVariant = {
    A: {
      doctor: 'Explore Clinical Productivity Path',
      researcher: 'Explore Research Accelerator Path',
      founder: 'Explore Doctor Entrepreneurship Path',
      reserve: 'Start Enrollment'
    },
    B: {
      doctor: 'Start Clinical AI Cohort',
      researcher: 'Join Research AI Cohort',
      founder: 'Build Venture Track Plan',
      reserve: 'Start Enrollment'
    }
  };

  const selectedLabels = ctaLabelByVariant[variant] || ctaLabelByVariant.A;

  const onPathClick = (nextId) => {
    setActiveId(nextId);
    void postEvent('audience_path_selected', { audience_path: nextId, assigned_variant: variant });
  };

  const onReserveClick = () => {
    void postEvent('webinar_cta_click', { cta_slot: 'hero_reserve', audience_path: active.id, assigned_variant: variant });
    const target = document.getElementById(enrollTargetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {PATHS.map((path) => {
          const activeTab = path.id === active.id;
          return (
            <button
              key={path.id}
              type="button"
              onClick={() => onPathClick(path.id)}
              className={`rounded-full border px-4 py-2.5 text-left transition ${
                activeTab
                  ? 'border-white/40 bg-white text-slate-900 shadow-[0_10px_30px_rgba(12,22,38,0.14)]'
                  : 'border-white/12 bg-white/5 text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-full ${activeTab ? 'bg-slate-100' : 'bg-white/5'}`}>
                  <PathGlyph id={path.id} active={activeTab} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${activeTab ? 'text-slate-500' : 'text-slate-300'}`}>
                    {path.kicker}
                  </p>
                  <h3 className={`mt-0.5 text-base font-extrabold ${activeTab ? 'text-slate-900' : 'text-white'}`}>{path.tab}</h3>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">{active.kicker}</p>
          <h3 className="mt-3 max-w-xl text-[2rem] font-extrabold leading-[0.98] text-white md:text-[2.6rem]">{active.headline}</h3>
          <p className="mt-4 max-w-xl text-[0.98rem] leading-7 text-slate-200">{active.fitLine}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {active.outcomes.slice(0, 2).map((item) => (
              <div key={item} className={`rounded-full border px-3 py-2 text-xs font-semibold ${active.accentClass}`}>
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {HERO_SINGLE_PRIMARY_MODE ? (
              <>
                <button
                  type="button"
                  onClick={onReserveClick}
                  className="rounded-full bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-900 transition hover:bg-slate-100"
                >
                  {selectedLabels.reserve}
                </button>
                <a
                  href={active.primaryHref}
                  onClick={() =>
                    void postEvent('webinar_cta_click', {
                      cta_slot: 'hero_primary',
                      audience_path: active.id,
                      assigned_variant: variant
                    })}
                  className="rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white/20"
                >
                  {selectedLabels[active.id] || active.primaryLabel}
                </a>
              </>
            ) : (
              <>
                <a
                  href={active.primaryHref}
                  onClick={() =>
                    void postEvent('webinar_cta_click', {
                      cta_slot: 'hero_primary',
                      audience_path: active.id,
                      assigned_variant: variant
                    })}
                  className="rounded-full bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-900 transition hover:bg-slate-100"
                >
                  {selectedLabels[active.id] || active.primaryLabel}
                </a>
                <button
                  type="button"
                  onClick={onReserveClick}
                  className="rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white/20"
                >
                  {selectedLabels.reserve}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-5 md:px-5 md:py-6">
          <div className={`pointer-events-none absolute inset-x-8 top-4 h-28 rounded-full bg-gradient-to-r ${active.glowClass} blur-3xl`} />
          <img
            src={active.visualSrc}
            alt={`${active.tab} preview`}
            className="relative z-[1] block w-full rounded-[1.4rem] bg-white/75 p-2 shadow-[0_24px_60px_rgba(12,22,38,0.18)]"
          />
          <div className="pointer-events-none absolute left-4 top-4 z-[2] rounded-full border border-white/14 bg-slate-950/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-100">
            {active.title}
          </div>
          <div className="pointer-events-none absolute right-4 top-5 z-[2] rounded-full border border-white/12 bg-white/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-100">
            {active.tab}
          </div>
          <div className="pointer-events-none absolute bottom-5 left-5 z-[2] max-w-[13rem] rounded-[1.1rem] bg-slate-950/58 px-4 py-3 shadow-[0_20px_45px_rgba(12,22,38,0.18)] backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">From</p>
            <p className="mt-1 text-sm font-semibold text-white">{active.transformation.from}</p>
          </div>
          <div className="pointer-events-none absolute bottom-5 right-5 z-[2] max-w-[13rem] rounded-[1.1rem] bg-white/92 px-4 py-3 shadow-[0_20px_45px_rgba(12,22,38,0.16)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">To</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{active.transformation.to}</p>
            <p className="mt-2 text-[11px] font-medium text-slate-600">{active.transformation.support}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
