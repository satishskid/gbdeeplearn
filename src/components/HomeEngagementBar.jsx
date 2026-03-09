import { useEffect, useMemo, useRef } from 'react';
import { apiUrl } from '../lib/api';
import { getSessionId, resolveCtaVariant } from '../lib/experiments';

const TRACK_ENDPOINT = apiUrl('/api/track');
const WEBINAR_ID = 'deep-rag-live-webinar';
const SCROLL_EVENTS = [
  { ratio: 0.25, event: 'webinar_scroll_25' },
  { ratio: 0.5, event: 'webinar_scroll_50' },
  { ratio: 0.75, event: 'webinar_scroll_75' }
];

export default function HomeEngagementBar({ enrollTargetId = 'enroll' }) {
  const firedRef = useRef(new Set());
  const sessionId = useMemo(() => getSessionId(), []);
  const variant = useMemo(() => resolveCtaVariant(sessionId), [sessionId]);

  const postEvent = async (eventName, extra = {}) => {
    try {
      await fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          webinar_id: WEBINAR_ID,
          source: 'landing',
          session_id: sessionId,
          cta_variant: variant,
          path: typeof window !== 'undefined' ? window.location.pathname : '/',
          ...extra
        })
      });
    } catch {
      // Ignore telemetry failures for UX actions.
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const ratio = scrollTop / maxScroll;

      for (const item of SCROLL_EVENTS) {
        if (ratio >= item.ratio && !firedRef.current.has(item.event)) {
          firedRef.current.add(item.event);
          void postEvent(item.event, { value: item.ratio * 100 });
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onReserveSeat = () => {
    void postEvent('webinar_sticky_cta_click', { assigned_variant: variant });
    const target = document.getElementById(enrollTargetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 md:hidden">
      <div className="rounded-2xl border border-slate-900/15 bg-white/95 p-2 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={onReserveSeat}
          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white"
        >
          Start Enrollment
        </button>
        <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          3 learning paths · mentor-led cohorts
        </p>
      </div>
    </aside>
  );
}
