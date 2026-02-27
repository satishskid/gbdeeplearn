import { useEffect, useMemo, useRef, useState } from 'react';

const TRACK_ENDPOINT = '/api/track';
const LEAD_ENDPOINT = '/api/lead/submit';
const DEFAULT_WEBINAR_ID = 'deep-rag-live-webinar';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

const WEBINAR_EVENTS = {
  view: 'webinar_landing_view',
  ctaClick: 'webinar_cta_click',
  scheduleClick: 'webinar_schedule_click',
  registerStart: 'webinar_registration_started',
  registerSubmit: 'webinar_registration_submitted',
  paymentOpen: 'payment_page_opened',
  paymentComplete: 'payment_completed'
};

function getSessionId() {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  const key = 'deeplearn_session_id';
  const current = window.localStorage.getItem(key);
  if (current) {
    return current;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function ensureTurnstileScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  const existing = document.querySelector('script[data-turnstile="true"]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile script failed to load.'));
    document.head.appendChild(script);
  });
}

export default function WebinarLeadForm({ siteKey = TURNSTILE_TEST_SITE_KEY }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadId, setLeadId] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const sessionId = useMemo(() => getSessionId(), []);

  const turnstileContainerRef = useRef(null);
  const widgetIdRef = useRef('');

  const postEvent = async (eventName, extra = {}) => {
    try {
      await fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          webinar_id: DEFAULT_WEBINAR_ID,
          source: 'landing',
          session_id: sessionId,
          path: typeof window !== 'undefined' ? window.location.pathname : '/',
          ...extra
        })
      });
    } catch {
      // Ignore telemetry failures to keep registration flow uninterrupted.
    }
  };

  const resetTurnstile = () => {
    if (typeof window === 'undefined' || !window.turnstile || !widgetIdRef.current) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
    setTurnstileToken('');
  };

  useEffect(() => {
    void postEvent(WEBINAR_EVENTS.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    const mountTurnstile = async () => {
      try {
        await ensureTurnstileScript();
      } catch {
        if (active) {
          setMessage('Bot protection failed to load. Refresh and try again.');
        }
        return;
      }

      if (!active || !window.turnstile || !turnstileContainerRef.current || widgetIdRef.current) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        action: 'webinar_register',
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken('')
      });
    };

    void mountTurnstile();

    return () => {
      active = false;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey]);

  const onRegister = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    await postEvent(WEBINAR_EVENTS.registerStart);

    if (!turnstileToken) {
      setStatus('error');
      setMessage('Please complete the anti-bot check before registering.');
      return;
    }

    try {
      const response = await fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          webinar_id: DEFAULT_WEBINAR_ID,
          source: 'landing',
          session_id: sessionId,
          turnstile_token: turnstileToken
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Registration failed.');
      }

      setStatus('success');
      setMessage('Seat reserved. You can proceed to payment and confirmation.');
      setLeadId(data.lead_id || '');
      await postEvent(WEBINAR_EVENTS.registerSubmit, { lead_id: data.lead_id });
      await postEvent(WEBINAR_EVENTS.paymentOpen, { lead_id: data.lead_id });
      resetTurnstile();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Registration failed.');
      resetTurnstile();
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-5 shadow-xl backdrop-blur-sm md:p-8">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Upcoming Live Class</p>
          <h2 className="text-3xl font-extrabold text-slate-900">Deep RAG Tutor Build Workshop</h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            90-minute implementation sprint with architecture teardown, ingestion pipeline, and growth analytics.
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          onClick={() => void postEvent(WEBINAR_EVENTS.scheduleClick)}
          type="button"
        >
          View Schedule
        </button>
      </div>

      <div className="mb-5 grid gap-2 text-sm md:grid-cols-3">
        <p className="rounded-xl bg-teal-50 px-3 py-2 font-medium text-teal-800">Module 1: Edge architecture</p>
        <p className="rounded-xl bg-cyan-50 px-3 py-2 font-medium text-cyan-800">Module 2: Tutor prompting + RAG</p>
        <p className="rounded-xl bg-amber-50 px-3 py-2 font-medium text-amber-800">Module 3: Funnel + analytics</p>
      </div>

      <form className="grid gap-3 md:grid-cols-3" onSubmit={onRegister}>
        <input
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

        <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <div ref={turnstileContainerRef} />
        </div>

        <div className="md:col-span-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={status === 'loading'}
            onClick={() => void postEvent(WEBINAR_EVENTS.ctaClick)}
          >
            {status === 'loading' ? 'Reserving...' : 'Reserve My Seat'}
          </button>

          {message && (
            <p className={`text-sm font-medium ${status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {message}
            </p>
          )}

          {status === 'success' && leadId && (
            <button
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              onClick={() => void postEvent(WEBINAR_EVENTS.paymentComplete, { lead_id: leadId })}
              type="button"
            >
              Mark Payment Complete
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
