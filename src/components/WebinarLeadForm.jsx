import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { apiUrl } from '../lib/api';
import { auth } from '../lib/firebase';

const TRACK_ENDPOINT = apiUrl('/api/track');
const REGISTER_ENDPOINT = apiUrl('/api/funnel/register');
const INTEREST_ENDPOINT = apiUrl('/api/funnel/interest');
const PAYMENT_ORDER_ENDPOINT = apiUrl('/api/funnel/payment/create-order');
const PAYMENT_STATUS_ENDPOINT = apiUrl('/api/funnel/payment/status');
const PAYMENT_VERIFY_ENDPOINT = apiUrl('/api/funnel/payment/verify');
const PAYMENT_SUCCESS_ENDPOINT = apiUrl('/api/funnel/payment/success');
const DEFAULT_WEBINAR_ID = 'deep-rag-live-webinar';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const COHORT_OVERVIEW_LINK = '/tracks';
const WHATSAPP_ENROLL_NUMBER = String(import.meta.env.PUBLIC_WHATSAPP_ENROLL_NUMBER || '').replace(/[^\d]/g, '');
const WHATSAPP_ENROLL_URL = String(import.meta.env.PUBLIC_WHATSAPP_ENROLL_URL || '').trim();
const TELEGRAM_ENROLL_URL = String(import.meta.env.PUBLIC_TELEGRAM_ENROLL_URL || '').trim();
const FALLBACK_WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/D8pR8tE6aYeLiE6PnU7gqL';
const FALLBACK_TELEGRAM_URL = 'https://t.me/greybrainsoai';
const COURSE_OPTIONS = [
  {
    slug: 'ai-productivity-clinical-practice',
    label: 'Path 1: Clinical Productivity'
  },
  {
    slug: 'in-silico-investigator-research',
    label: 'Path 2: AI Research Accelerator'
  },
  {
    slug: 'doctor-ai-venture-builder',
    label: 'Path 3: Venture Builder'
  }
];

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

function ensureRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  const existing = document.querySelector('script[data-razorpay="true"]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.defer = true;
    script.dataset.razorpay = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay script failed to load.'));
    document.head.appendChild(script);
  });
}

function resolveGoogleAllowedHosts() {
  const configured = String(import.meta.env.PUBLIC_GOOGLE_AUTH_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) return configured;
  return ['edu.greybrain.ai', 'gbdeeplearn.pages.dev', 'localhost', '127.0.0.1'];
}

function isGoogleAuthEnabledForHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return false;
  const allowed = resolveGoogleAllowedHosts();
  return allowed.some((rule) => host === rule || host.endsWith(`.${rule}`));
}

export default function WebinarLeadForm({
  siteKey = TURNSTILE_TEST_SITE_KEY,
  mode = 'full',
  defaultCourseSlug = COURSE_OPTIONS[0].slug
}) {
  const initialCourseSlug = COURSE_OPTIONS.some((item) => item.slug === defaultCourseSlug)
    ? defaultCourseSlug
    : COURSE_OPTIONS[0].slug;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadId, setLeadId] = useState('');
  const [selectedCourseSlug, setSelectedCourseSlug] = useState(initialCourseSlug);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [activation, setActivation] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showAltActions, setShowAltActions] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showPaymentAssist, setShowPaymentAssist] = useState(false);
  const [upiQr, setUpiQr] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const sessionId = useMemo(() => getSessionId(), []);
  const currentHost = useMemo(
    () => (typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''),
    []
  );
  const googleAuthAvailable = useMemo(() => isGoogleAuthEnabledForHost(currentHost), [currentHost]);
  const showGoogleDomainHint = useMemo(() => Boolean(currentHost) && !googleAuthAvailable, [currentHost, googleAuthAvailable]);
  const selectedCourse = useMemo(
    () => COURSE_OPTIONS.find((option) => option.slug === selectedCourseSlug) || COURSE_OPTIONS[0],
    [selectedCourseSlug]
  );

  const turnstileContainerRef = useRef(null);
  const widgetIdRef = useRef('');
  const paymentPollTimerRef = useRef(0);
  const paymentPollBusyRef = useRef(false);

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

  const captureInterest = async ({ channel, destinationUrl = '' }) => {
    try {
      await fetch(INTEREST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          channel,
          webinar_id: DEFAULT_WEBINAR_ID,
          session_id: sessionId,
          full_name: fullName,
          email,
          phone,
          course_slug: selectedCourseSlug,
          destination_url: destinationUrl
        })
      });
    } catch {
      // Ignore interest-capture failures to avoid blocking click-through.
    }
  };

  const resetTurnstile = () => {
    if (typeof window === 'undefined' || !window.turnstile || !widgetIdRef.current) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
    setTurnstileToken('');
  };

  const stopPaymentPolling = () => {
    if (typeof window !== 'undefined' && paymentPollTimerRef.current) {
      window.clearInterval(paymentPollTimerRef.current);
      paymentPollTimerRef.current = 0;
    }
  };

  const syncPaymentStatus = async ({ silent = false } = {}) => {
    if (!leadId) return false;
    if (paymentPollBusyRef.current) return false;

    paymentPollBusyRef.current = true;
    if (!silent) setIsCheckingStatus(true);

    try {
      const params = new URLSearchParams();
      params.set('lead_id', leadId);
      if (email) params.set('email', email);

      const response = await fetch(`${PAYMENT_STATUS_ENDPOINT}?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to fetch payment status.');
      }

      const paymentStatus = String(payload?.payment?.status || '').toLowerCase();
      if (paymentStatus === 'paid' && payload?.enrollment?.user_id) {
        setActivation(payload.enrollment);
        setStatus('success');
        setMessage('Payment confirmed. Learner access is now active.');
        setUpiQr(null);
        stopPaymentPolling();
        return true;
      }

      if (!silent) {
        setStatus('success');
        setMessage(`Current payment status: ${paymentStatus || 'registered'}.`);
      }
      return false;
    } catch (error) {
      if (!silent) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to check payment status.');
      }
      return false;
    } finally {
      paymentPollBusyRef.current = false;
      if (!silent) setIsCheckingStatus(false);
    }
  };

  const startPaymentPolling = () => {
    if (typeof window === 'undefined' || paymentPollTimerRef.current || !leadId) return;
    paymentPollTimerRef.current = window.setInterval(() => {
      void syncPaymentStatus({ silent: true });
    }, 5000);
  };

  useEffect(() => {
    void postEvent(WEBINAR_EVENTS.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showManualForm) {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = '';
      }
      setTurnstileToken('');
      return;
    }

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
        widgetIdRef.current = '';
      }
    };
  }, [siteKey, showManualForm]);

  useEffect(() => {
    return () => {
      stopPaymentPolling();
    };
  }, []);

  const registerLead = async ({
    name,
    emailAddress,
    phoneNumber = '',
    source = 'landing',
    turnstileTokenValue = '',
    firebaseIdToken = ''
  }) => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: name,
        email: emailAddress,
        phone: phoneNumber,
        course_slug: selectedCourseSlug,
        webinar_id: DEFAULT_WEBINAR_ID,
        source,
        session_id: sessionId,
        turnstile_token: turnstileTokenValue,
        firebase_id_token: firebaseIdToken
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Registration failed.');
    }
    return data;
  };

  const onRegister = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    setActivation(null);
    setShowPaymentAssist(false);
    setUpiQr(null);
    stopPaymentPolling();

    await postEvent(WEBINAR_EVENTS.registerStart);

    if (!turnstileToken) {
      setStatus('error');
      setMessage('Please complete the anti-bot check before registering.');
      return;
    }

    try {
      const data = await registerLead({
        name: fullName,
        emailAddress: email,
        phoneNumber: phone,
        source: 'landing_form',
        turnstileTokenValue: turnstileToken
      });

      setStatus('success');
      const courseTitle = data?.registration?.course_title ? ` for ${data.registration.course_title}` : '';
      setMessage(`Seat reserved${courseTitle}. Complete payment to activate access.`);
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

  const onGoogleQuickEnroll = async () => {
    void postEvent(WEBINAR_EVENTS.ctaClick, { cta_slot: 'google_quick_enroll' });
    void captureInterest({ channel: 'google', destinationUrl: currentHost ? `https://${currentHost}/#enroll` : '' });
    if (!googleAuthAvailable) {
      setStatus('error');
      setMessage(
        `Google sign-in is not enabled on ${currentHost || 'this domain'}. Use edu.greybrain.ai or add this domain in Firebase Auth > Settings > Authorized domains.`
      );
      return;
    }

    setStatus('loading');
    setMessage('');
    setActivation(null);
    setShowPaymentAssist(false);
    setUpiQr(null);
    stopPaymentPolling();
    setIsGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const firebaseIdToken = await credential.user.getIdToken();
      const googleName = String(credential.user.displayName || fullName || '').trim();
      const googleEmail = String(credential.user.email || email || '').trim().toLowerCase();

      if (!googleEmail) {
        throw new Error('Google account email is required for enrollment.');
      }

      setFullName(googleName || fullName || 'Learner');
      setEmail(googleEmail);

      await postEvent(WEBINAR_EVENTS.registerStart, { flow: 'google_one_click' });
      const data = await registerLead({
        name: googleName || fullName || 'Learner',
        emailAddress: googleEmail,
        phoneNumber: phone,
        source: 'google_one_click',
        firebaseIdToken
      });

      setLeadId(data.lead_id || '');
      setStatus('success');
      setShowManualForm(false);
      const courseTitle = data?.registration?.course_title ? ` for ${data.registration.course_title}` : '';
      setMessage(`One-click reserved${courseTitle}. Opening secure UPI checkout...`);
      await postEvent(WEBINAR_EVENTS.registerSubmit, { lead_id: data.lead_id, flow: 'google_one_click' });
      await postEvent(WEBINAR_EVENTS.paymentOpen, { lead_id: data.lead_id, flow: 'google_one_click' });
      await activateAccess({
        targetLeadId: data.lead_id,
        targetEmail: googleEmail,
        targetName: googleName || fullName || 'Learner',
        source: 'google_one_click'
      });
    } catch (error) {
      const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (errorCode === 'auth/unauthorized-domain') {
        setStatus('error');
        setMessage(
          `Google sign-in blocked for ${currentHost || 'this domain'}. Add it in Firebase Auth > Settings > Authorized domains, then retry.`
        );
        return;
      }
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Google enrollment failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onWhatsAppQuickEnroll = () => {
    const text = [
      'Hi GreyBrain team, I want to enroll in the next cohort.',
      `Selected track: ${selectedCourse.label}.`,
      fullName ? `Name: ${fullName}.` : '',
      email ? `Email: ${email}.` : '',
      phone ? `Phone: ${phone}.` : ''
    ]
      .filter(Boolean)
      .join(' ');

    const quickUrl = WHATSAPP_ENROLL_NUMBER
      ? `https://wa.me/${WHATSAPP_ENROLL_NUMBER}?text=${encodeURIComponent(text)}`
      : WHATSAPP_ENROLL_URL || FALLBACK_WHATSAPP_GROUP_URL;

    if (!quickUrl) {
      setStatus('error');
      setMessage('WhatsApp enrollment destination is not configured.');
      return;
    }

    void captureInterest({ channel: 'whatsapp', destinationUrl: quickUrl });
    window.open(quickUrl, '_blank', 'noopener,noreferrer');
    void postEvent('webinar_cta_click', { cta_slot: 'whatsapp_quick_enroll' });
  };

  const onTelegramQuickEnroll = () => {
    const quickUrl = TELEGRAM_ENROLL_URL || FALLBACK_TELEGRAM_URL;
    if (!quickUrl) return;
    void captureInterest({ channel: 'telegram', destinationUrl: quickUrl });
    window.open(quickUrl, '_blank', 'noopener,noreferrer');
    void postEvent('webinar_cta_click', { cta_slot: 'telegram_quick_enroll' });
  };

  const activateAccess = async ({ targetLeadId, targetEmail, targetName, source = 'landing' }) => {
    setIsActivating(true);
    setMessage('');
    try {
      const orderResponse = await fetch(PAYMENT_ORDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: targetLeadId,
          course_slug: selectedCourseSlug,
          email: targetEmail,
          full_name: targetName,
          source
        })
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderData?.error || 'Unable to create payment order.');
      }

      if (orderData?.mode === 'demo') {
        const demoResponse = await fetch(PAYMENT_SUCCESS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: targetLeadId,
            course_slug: selectedCourseSlug,
            email: targetEmail,
            full_name: targetName,
            payment_provider: 'demo',
            payment_ref: `demo_${Date.now()}`,
            amount_cents: Number(orderData?.order?.amount_cents || 100),
            currency: orderData?.order?.currency || 'INR',
            source: 'landing-demo',
            payment_status: 'paid'
          })
        });
        const demoData = await demoResponse.json();
        if (!demoResponse.ok) {
          throw new Error(demoData?.error || 'Demo payment activation failed.');
        }
        setActivation(demoData?.enrollment || null);
        setStatus('success');
        setMessage('Demo payment confirmed. Learner access is active.');
        await postEvent(WEBINAR_EVENTS.paymentComplete, { lead_id: targetLeadId });
        return true;
      }

      await ensureRazorpayScript();
      if (!window.Razorpay) {
        throw new Error('Razorpay checkout is unavailable. Please refresh and try again.');
      }

      const checkoutPayload = await new Promise((resolve, reject) => {
        const razorpay = new window.Razorpay({
          key: orderData?.key_id,
          order_id: orderData?.order?.id,
          amount: orderData?.order?.amount_cents,
          currency: orderData?.order?.currency || 'INR',
          name: 'GreyBrain Academy',
          description: orderData?.enrollment_target?.course_title || 'Course Enrollment',
          prefill: {
            name: targetName,
            email: targetEmail,
            contact: phone
          },
          notes: {
            lead_id: targetLeadId,
            course_slug: selectedCourseSlug
          },
          method: {
            upi: true,
            card: false,
            netbanking: false,
            wallet: false,
            emi: false,
            paylater: false
          },
          handler: (response) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Payment was cancelled.'))
          }
        });
        razorpay.open();
      });

      const verifyResponse = await fetch(PAYMENT_VERIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: targetLeadId,
          email: targetEmail,
          course_slug: selectedCourseSlug,
          razorpay_order_id: checkoutPayload?.razorpay_order_id,
          razorpay_payment_id: checkoutPayload?.razorpay_payment_id,
          razorpay_signature: checkoutPayload?.razorpay_signature
        })
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyData?.error || 'Payment verification failed.');
      }

      setActivation(verifyData?.enrollment || null);
      setUpiQr(null);
      stopPaymentPolling();
      setStatus('success');
      setMessage('Payment confirmed. Learner access is now active.');
      await postEvent(WEBINAR_EVENTS.paymentComplete, { lead_id: targetLeadId });
      return true;
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Payment activation failed.');
      return false;
    } finally {
      setIsActivating(false);
    }
  };

  const onActivateAccess = async () => {
    if (!leadId) {
      setMessage('Register first to generate a lead ID.');
      setStatus('error');
      return;
    }

    await activateAccess({
      targetLeadId: leadId,
      targetEmail: email,
      targetName: fullName || 'Learner',
      source: 'landing'
    });
  };

  const onGenerateUpiQr = async () => {
    if (!leadId) {
      setMessage('Register first to generate a lead ID.');
      setStatus('error');
      return;
    }

    setIsGeneratingQr(true);
    setMessage('');
    try {
      const orderResponse = await fetch(PAYMENT_ORDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          course_slug: selectedCourseSlug,
          email,
          full_name: fullName,
          source: 'landing',
          payment_mode: 'upi_qr',
          qr_close_seconds: 900
        })
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderData?.error || 'Unable to generate UPI QR.');
      }

      if (!orderData?.upi_qr?.image_url) {
        throw new Error('UPI QR was not returned by payment gateway.');
      }

      setUpiQr(orderData.upi_qr);
      setStatus('success');
      setMessage('UPI QR generated. Scan and pay; access will auto-activate.');
      startPaymentPolling();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'UPI QR generation failed.');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  if (mode === 'compact') {
    return (
      <section className="overflow-hidden rounded-[1.2rem] bg-transparent p-0 md:rounded-[1.45rem]">
        <div className="grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="rounded-[1.1rem] bg-white/52 p-4 shadow-[0_10px_24px_rgba(12,22,38,0.03)] ring-1 ring-white/50 md:rounded-[1.25rem] md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Enrollment</p>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                Intake open
              </span>
            </div>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-slate-900 md:text-2xl">Register once, then move directly into cohort onboarding.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 md:leading-7">
              Continue with Google to create the learner record used for cohort access, AI tutor support, assignments,
              and certificate-linked progression.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 md:mt-4">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                Selected: {selectedCourse.label}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                Google-first flow
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center md:mt-5 md:gap-3">
              <button
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
                type="button"
                disabled={status === 'loading' || isGoogleLoading || !googleAuthAvailable}
                onClick={() => void onGoogleQuickEnroll()}
              >
                {isGoogleLoading ? 'Connecting Google...' : 'Continue with Google'}
              </button>
              <a
                href={COHORT_OVERVIEW_LINK}
                className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Review Cohorts
              </a>
            </div>
          </div>

          <div className="rounded-[1.1rem] bg-white/40 p-4 shadow-[0_10px_24px_rgba(12,22,38,0.03)] ring-1 ring-white/45 md:rounded-[1.25rem] md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Newsletter</p>
            <h3 className="mt-2 text-lg font-extrabold text-slate-900">Subscribe to AI School updates</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 md:leading-7">
              Follow the daily stream of clinical AI briefs, model watch notes, and cohort announcements.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-5">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50/80 text-emerald-800 ring-1 ring-emerald-200/70 transition hover:bg-emerald-100 md:h-12 md:w-12 md:rounded-2xl"
                type="button"
                onClick={() => onWhatsAppQuickEnroll()}
                title="Subscribe on WhatsApp"
                aria-label="Subscribe on WhatsApp"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M20.5 3.5A11.4 11.4 0 0 0 2.9 17.3L1.5 22.5l5.3-1.4A11.4 11.4 0 1 0 20.5 3.5Zm-8.6 17a9.5 9.5 0 0 1-4.8-1.3l-.3-.2-3.1.8.8-3-.2-.3A9.5 9.5 0 1 1 12 20.5Zm5.2-6.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2l-.6.9c-.2.2-.3.3-.6.1-.3-.2-1.2-.4-2.3-1.4-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6s-.7-1.7-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.3 3.6 5.6 5 .8.3 1.5.5 2 .7.8.2 1.5.2 2 .1.6-.1 1.8-.7 2.1-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z" />
                </svg>
              </button>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50/85 text-sky-800 ring-1 ring-sky-200/70 transition hover:bg-sky-100 md:h-12 md:w-12 md:rounded-2xl"
                type="button"
                onClick={() => onTelegramQuickEnroll()}
                title="Subscribe on Telegram"
                aria-label="Subscribe on Telegram"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M21.6 4.5c.3-.9-.3-1.6-1.2-1.3L2.5 10.2c-.9.3-.9 1.1-.2 1.4l4.6 1.4 1.8 5.5c.2.7.4 1 1 1 .4 0 .6-.2.8-.5l2.6-2.5 4.5 3.3c.8.4 1.3.2 1.5-.7L21.6 4.5Zm-4 2.4-7.7 6.9-.3 3.1-1.3-4.2 9.3-5.8Z" />
                </svg>
              </button>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Use Telegram or WhatsApp only for updates and announcements. Enrollment itself stays structured through the academy flow.
            </p>
          </div>
        </div>

        {showGoogleDomainHint ? (
          <p className="mt-3 text-xs text-amber-700">
            Google enrollment is enabled on edu.greybrain.ai. Current host: {currentHost || 'unknown'}.
          </p>
        ) : null}

        {message ? (
          <p className={`mt-3 text-sm font-medium ${status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {message}
          </p>
        ) : null}

        {activation?.user_id ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-emerald-700">Access is active. Continue to the learner workspace.</p>
            <a
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
              href="/learn"
            >
              Open Learner Hub
            </a>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-5 shadow-xl backdrop-blur-sm md:p-8">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Upcoming Cohort Intake</p>
          <h2 className="text-3xl font-extrabold text-slate-900">Enroll In Under 60 Seconds</h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            Weekly mentor-led sessions, assignments, and AI tutor support for doctors across productivity, research,
            and venture tracks.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Current selection: {selectedCourse.label}
          </p>
        </div>
        <a
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          href={COHORT_OVERVIEW_LINK}
          onClick={() => void postEvent(WEBINAR_EVENTS.scheduleClick)}
          target="_self"
        >
          View Cohort Plan
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2 md:col-span-3"
          value={selectedCourseSlug}
          onChange={(e) => setSelectedCourseSlug(e.target.value)}
        >
          {COURSE_OPTIONS.map((option) => (
            <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
        </select>

        <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Quick Enrollment</p>
          <p className="mt-1 text-sm text-slate-600">Start with Google. Alternate channels are available only if needed.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={status === 'loading' || isGoogleLoading || !googleAuthAvailable}
              onClick={() => void onGoogleQuickEnroll()}
            >
              {isGoogleLoading ? 'Connecting Google...' : 'Continue with Google'}
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={() =>
                setShowAltActions((prev) => {
                  const next = !prev;
                  if (!next) setShowManualForm(false);
                  return next;
                })
              }
            >
              {showAltActions ? 'Hide More Options' : 'More Options'}
            </button>
          </div>
          {showAltActions ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
                type="button"
                onClick={() => onWhatsAppQuickEnroll()}
              >
                Continue on WhatsApp
              </button>
              <button
                className="rounded-xl border border-sky-300 bg-sky-50 px-5 py-2.5 text-sm font-bold text-sky-800 transition hover:bg-sky-100"
                type="button"
                onClick={() => onTelegramQuickEnroll()}
              >
                Continue on Telegram
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={() => setShowManualForm((prev) => !prev)}
              >
                {showManualForm ? 'Hide Email Fallback' : 'Use Email Instead'}
              </button>
            </div>
          ) : null}
          {showGoogleDomainHint ? (
            <p className="mt-2 text-xs text-amber-700">
              Google enrollment is enabled on edu.greybrain.ai. Current host: {currentHost || 'unknown'}.
            </p>
          ) : null}
        </div>

        {showManualForm ? (
          <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Email fallback enrollment</p>
            <p className="mt-1 text-xs text-slate-500">Use this only if Google/WhatsApp is not available.</p>
            <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={onRegister}>
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
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div ref={turnstileContainerRef} />
              </div>
              <p className="md:col-span-3 text-xs text-slate-500">Protected by Cloudflare Turnstile (anti-bot check).</p>
              <div className="md:col-span-3">
                <button
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={status === 'loading'}
                  onClick={() => void postEvent(WEBINAR_EVENTS.ctaClick)}
                >
                  {status === 'loading' ? 'Reserving...' : 'Reserve With Email'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="md:col-span-3 flex flex-wrap items-center gap-3">
          {message ? (
            <p className={`text-sm font-medium ${status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {message}
            </p>
          ) : null}

          {status === 'success' && leadId && !activation?.user_id && (
            <>
              <button
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                onClick={() => void onActivateAccess()}
                type="button"
                disabled={isActivating}
              >
                {isActivating ? 'Opening UPI...' : 'Continue to Secure UPI Checkout'}
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setShowPaymentAssist((prev) => !prev)}
                type="button"
              >
                {showPaymentAssist ? 'Hide Payment Assist' : 'Payment Assist'}
              </button>
            </>
          )}

          {activation?.user_id ? (
            <a
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
              href="/learn"
            >
              Open Learner Hub
            </a>
          ) : null}
        </div>

        {activation?.user_id ? (
          <p className="md:col-span-3 text-xs text-emerald-700">Access is active. Open Learner Hub to start your pre-read and tutor session.</p>
        ) : null}

        {status === 'success' && leadId && !activation?.user_id && showPaymentAssist ? (
          <div className="md:col-span-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
            <p className="text-sm font-semibold text-violet-900">Alternate payment support</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-800 transition hover:bg-violet-100"
                onClick={() => void onGenerateUpiQr()}
                type="button"
                disabled={isGeneratingQr}
              >
                {isGeneratingQr ? 'Generating QR...' : 'Generate UPI QR'}
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => void syncPaymentStatus()}
                type="button"
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? 'Checking...' : 'Check Payment Status'}
              </button>
            </div>
            {upiQr?.image_url ? (
              <img
                src={upiQr.image_url}
                alt="UPI QR code"
                className="mt-3 h-56 w-56 rounded-lg border border-violet-200 bg-white p-2"
                loading="lazy"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
