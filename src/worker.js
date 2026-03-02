import { Hono } from 'hono';

const app = new Hono();

const TUTOR_PROMPT = `You are a Socratic Teaching Assistant. Use only the provided context.
If context is missing, reply exactly: "I cannot find that in the syllabus."`;

const WEBINAR_EVENTS = new Set([
  'webinar_landing_view',
  'webinar_cta_click',
  'webinar_schedule_click',
  'webinar_registration_started',
  'webinar_registration_submitted',
  'payment_page_opened',
  'payment_completed'
]);

const COURSE_STATUSES = new Set(['draft', 'published', 'live', 'completed', 'archived']);
const STAFF_ROLES = new Set(['teacher', 'coordinator']);
const LEARNER_STATUSES = new Set(['active', 'completed', 'dropped']);
const CONTENT_STATUSES = new Set(['draft', 'approved', 'published', 'rejected']);
const DAILY_PROMPT_VERSION = 'v1.0.0';
const PATH_KEYS = new Set(['productivity', 'research', 'entrepreneurship']);
const COHORT_MODES = new Set(['instructor-led', 'self-paced']);
const COHORT_STATUSES = new Set(['draft', 'open', 'live', 'completed', 'archived']);
const MODULE_PROGRESS_STATUSES = new Set(['locked', 'unlocked', 'in_progress', 'submitted', 'completed', 'passed', 'failed']);
const PAYMENT_STATUSES = new Set(['registered', 'paid', 'failed', 'refunded']);

app.get('/', (c) => {
  return c.json({
    service: 'deeplearn-worker',
    status: 'ok',
    endpoints: [
      '/api/chat/tutor',
      '/api/track',
      '/api/lead/submit',
      '/api/funnel/register',
      '/api/funnel/payment/success',
      '/api/analytics/funnel',
      '/api/admin/analytics/summary',
      '/api/admin/analytics/paths',
      '/api/content/posts',
      '/api/admin/overview',
      '/api/admin/organizations',
      '/api/admin/courses',
      '/api/admin/courses/:courseId/modules',
      '/api/admin/courses/:courseId/rubrics',
      '/api/admin/cohorts',
      '/api/admin/cohorts/:cohortId/enroll',
      '/api/admin/cohorts/:cohortId/enrollments',
      '/api/learn/modules/:moduleId/progress',
      '/api/learn/access',
      '/api/lab/run',
      '/api/lab/runs',
      '/api/learn/capstone/submit',
      '/api/learn/capstone/artifacts',
      '/api/learn/capstone/:artifactId/review',
      '/api/learn/assignments/:moduleId/submit',
      '/api/learn/assignments/:submissionId/grade',
      '/api/admin/content/generate-daily',
      '/api/admin/content/posts',
      '/health'
    ]
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/chat/tutor', async (c) => {
  try {
    const { message, groq_key: groqKey, current_context_id: moduleId } = await c.req.json();

    const apiKey = (groqKey || c.env.GROQ_API_KEY || '').trim();

    if (!message || !apiKey) {
      return c.json({ error: 'message and groq_key (or server GROQ_API_KEY) are required.' }, 400);
    }

    const context = await queryCourseContext(c.env, message, moduleId);
    const baseUrl = resolveGroqBaseUrl(c.env);
    const model = resolveGroqModel(c.env, baseUrl);

    const requestBody = {
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `${TUTOR_PROMPT}\n\nCourse Context:\n${context}`
        },
        { role: 'user', content: message }
      ]
    };

    let response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let details = await response.text();
      if (shouldFallbackToDirectGroq(baseUrl, details)) {
        const directBaseUrl = resolveDirectGroqBaseUrl(c.env);
        const directModel = resolveGroqModel(c.env, directBaseUrl);
        response = await fetch(`${directBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...requestBody, model: directModel })
        });
        if (!response.ok) {
          details = await response.text();
          return c.json({ error: 'Groq request failed.', details }, 502);
        }
      } else {
        return c.json({ error: 'Groq request failed.', details }, 502);
      }
    }

    const payload = await response.json();
    const reply = payload?.choices?.[0]?.message?.content ?? 'I cannot find that in the syllabus.';

    return c.json({ reply, contextUsed: context });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to process tutor request.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/track', async (c) => {
  try {
    const payload = await c.req.json();
    const eventName = clean(payload?.event_name, 64);

    if (!WEBINAR_EVENTS.has(eventName)) {
      return c.json({ error: 'Invalid event_name.' }, 400);
    }

    const sessionId = clean(payload?.session_id, 64) || crypto.randomUUID();
    const webinarId = clean(payload?.webinar_id, 64) || 'deep-rag-live-webinar';
    const source = clean(payload?.source, 64) || 'landing';
    const leadId = clean(payload?.lead_id, 64);
    const path = clean(payload?.path, 160) || new URL(c.req.url).pathname;
    const value = Number.isFinite(Number(payload?.value)) ? Number(payload.value) : 1;

    await writeGrowthEvent(c.env, c.req.raw.cf, {
      eventName,
      webinarId,
      source,
      leadId,
      sessionId,
      path,
      value
    });

    return c.json({ ok: true, session_id: sessionId });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to track event.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/lead/submit', async (c) => {
  try {
    const payload = await c.req.json();
    const fullName = clean(payload?.full_name, 120);
    const email = clean(payload?.email, 200).toLowerCase();
    const phone = clean(payload?.phone, 24);
    const webinarId = clean(payload?.webinar_id, 64) || 'deep-rag-live-webinar';
    const source = clean(payload?.source, 64) || 'landing';
    const sessionId = clean(payload?.session_id, 64) || crypto.randomUUID();
    const courseIdInput = clean(payload?.course_id, 64);
    const courseSlugInput = slugify(clean(payload?.course_slug, 120));
    const cohortIdInput = clean(payload?.cohort_id, 64);
    const turnstileToken = clean(payload?.turnstile_token, 4096);
    const turnstileRequired = (c.env.TURNSTILE_REQUIRED || 'true').toLowerCase() !== 'false';

    if (!fullName || !email || !phone) {
      return c.json({ error: 'full_name, email, and phone are required.' }, 400);
    }

    if (!isValidEmail(email)) {
      return c.json({ error: 'Invalid email format.' }, 400);
    }

    if (turnstileRequired) {
      if (!turnstileToken) {
        return c.json({ error: 'Turnstile token is required.' }, 400);
      }

      const verification = await verifyTurnstile({
        secret: c.env.TURNSTILE_SECRET_KEY,
        token: turnstileToken,
        remoteIp: c.req.header('CF-Connecting-IP') || ''
      });

      if (!verification.success) {
        return c.json({ error: 'Turnstile verification failed.', details: verification.errorCodes }, 403);
      }
    }

    if (!c.env.DEEPLEARN_LEADS) {
      return c.json({ error: 'Lead storage is not configured.' }, 500);
    }

    const leadId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const emailHash = await sha256Hex(email);
    let target = {
      courseId: courseIdInput,
      courseSlug: courseSlugInput,
      courseTitle: '',
      cohortId: cohortIdInput
    };

    if (c.env.DEEPLEARN_DB && (courseIdInput || courseSlugInput || cohortIdInput)) {
      await ensureOpsSchema(c.env.DEEPLEARN_DB);
      const resolved = await resolveLearningTargetByCourse(c.env.DEEPLEARN_DB, {
        courseId: courseIdInput,
        courseSlug: courseSlugInput,
        cohortId: cohortIdInput
      });
      target = {
        courseId: resolved.courseId,
        courseSlug: resolved.courseSlug,
        courseTitle: resolved.courseTitle,
        cohortId: resolved.cohortId
      };
    }

    const lead = {
      lead_id: leadId,
      created_at: createdAt,
      full_name: fullName,
      email,
      phone,
      webinar_id: webinarId,
      source,
      session_id: sessionId,
      course_id: target.courseId || '',
      course_slug: target.courseSlug || '',
      cohort_id: target.cohortId || '',
      user_agent: c.req.header('user-agent') || '',
      referrer: c.req.header('referer') || '',
      country: c.req.raw.cf?.country || 'XX'
    };

    const objectKey = `leads/${webinarId}/${createdAt.slice(0, 10)}/${leadId}.json`;
    await c.env.DEEPLEARN_LEADS.put(objectKey, JSON.stringify(lead), {
      httpMetadata: { contentType: 'application/json' }
    });

    await writeGrowthEvent(c.env, c.req.raw.cf, {
      eventName: 'webinar_registration_submitted',
      webinarId,
      source,
      leadId,
      sessionId,
      path: '/api/lead/submit',
      value: 1,
      emailHash
    });

    if (c.env.DEEPLEARN_DB) {
      await ensureOpsSchema(c.env.DEEPLEARN_DB);
      const nowMs = Date.now();
      const metadata = {
        route: '/api/lead/submit',
        user_agent: c.req.header('user-agent') || '',
        referrer: c.req.header('referer') || ''
      };
      await c.env.DEEPLEARN_DB.prepare(
        `INSERT INTO lead_registrations (
           lead_id, full_name, email, phone, webinar_id, source, session_id,
           course_id, course_slug, cohort_id, user_id, payment_status, payment_ref,
           payment_provider, paid_at_ms, metadata_json, created_at_ms, updated_at_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'registered', '', '', NULL, ?, ?, ?)
         ON CONFLICT(lead_id) DO UPDATE SET
           full_name = excluded.full_name,
           email = excluded.email,
           phone = excluded.phone,
           webinar_id = excluded.webinar_id,
           source = excluded.source,
           session_id = excluded.session_id,
           course_id = excluded.course_id,
           course_slug = excluded.course_slug,
           cohort_id = excluded.cohort_id,
           updated_at_ms = excluded.updated_at_ms`
      )
        .bind(
          leadId,
          fullName,
          email,
          phone,
          webinarId,
          source,
          sessionId,
          target.courseId || '',
          target.courseSlug || '',
          target.cohortId || '',
          JSON.stringify(metadata),
          nowMs,
          nowMs
        )
        .run();
    }

    return c.json({
      ok: true,
      lead_id: leadId,
      registration: {
        course_id: target.courseId || '',
        course_slug: target.courseSlug || '',
        course_title: target.courseTitle || '',
        cohort_id: target.cohortId || '',
        payment_status: 'registered'
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to submit lead.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/funnel/register', async (c) => {
  try {
    const payload = await c.req.json();
    const fullName = clean(payload?.full_name, 120);
    const email = clean(payload?.email, 200).toLowerCase();
    const phone = clean(payload?.phone, 24);
    const webinarId = clean(payload?.webinar_id, 64) || 'deep-rag-live-webinar';
    const source = clean(payload?.source, 64) || 'landing';
    const sessionId = clean(payload?.session_id, 64) || crypto.randomUUID();
    const courseIdInput = clean(payload?.course_id, 64);
    const courseSlugInput = slugify(clean(payload?.course_slug, 120));
    const cohortIdInput = clean(payload?.cohort_id, 64);
    const turnstileToken = clean(payload?.turnstile_token, 4096);
    const turnstileRequired = (c.env.TURNSTILE_REQUIRED || 'true').toLowerCase() !== 'false';

    if (!fullName || !email || !phone) {
      return c.json({ error: 'full_name, email, and phone are required.' }, 400);
    }
    if (!isValidEmail(email)) {
      return c.json({ error: 'Invalid email format.' }, 400);
    }
    if (!c.env.DEEPLEARN_LEADS) {
      return c.json({ error: 'Lead storage is not configured.' }, 500);
    }
    if (!c.env.DEEPLEARN_DB) {
      return c.json({ error: 'D1 is not configured.' }, 500);
    }

    if (turnstileRequired) {
      if (!turnstileToken) {
        return c.json({ error: 'Turnstile token is required.' }, 400);
      }
      const verification = await verifyTurnstile({
        secret: c.env.TURNSTILE_SECRET_KEY,
        token: turnstileToken,
        remoteIp: c.req.header('CF-Connecting-IP') || ''
      });
      if (!verification.success) {
        return c.json({ error: 'Turnstile verification failed.', details: verification.errorCodes }, 403);
      }
    }

    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const target = await resolveLearningTargetByCourse(c.env.DEEPLEARN_DB, {
      courseId: courseIdInput,
      courseSlug: courseSlugInput,
      cohortId: cohortIdInput
    });

    const leadId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const emailHash = await sha256Hex(email);
    const lead = {
      lead_id: leadId,
      created_at: createdAt,
      full_name: fullName,
      email,
      phone,
      webinar_id: webinarId,
      source,
      session_id: sessionId,
      course_id: target.courseId || '',
      course_slug: target.courseSlug || '',
      cohort_id: target.cohortId || '',
      user_agent: c.req.header('user-agent') || '',
      referrer: c.req.header('referer') || '',
      country: c.req.raw.cf?.country || 'XX'
    };

    const objectKey = `leads/${webinarId}/${createdAt.slice(0, 10)}/${leadId}.json`;
    await c.env.DEEPLEARN_LEADS.put(objectKey, JSON.stringify(lead), {
      httpMetadata: { contentType: 'application/json' }
    });

    const nowMs = Date.now();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO lead_registrations (
         lead_id, full_name, email, phone, webinar_id, source, session_id,
         course_id, course_slug, cohort_id, user_id, payment_status, payment_ref,
         payment_provider, paid_at_ms, metadata_json, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'registered', '', '', NULL, ?, ?, ?)`
    )
      .bind(
        leadId,
        fullName,
        email,
        phone,
        webinarId,
        source,
        sessionId,
        target.courseId || '',
        target.courseSlug || '',
        target.cohortId || '',
        JSON.stringify({ route: '/api/funnel/register' }),
        nowMs,
        nowMs
      )
      .run();

    await writeGrowthEvent(c.env, c.req.raw.cf, {
      eventName: 'webinar_registration_submitted',
      webinarId,
      source,
      leadId,
      sessionId,
      path: '/api/funnel/register',
      value: 1,
      emailHash
    });

    return c.json({
      ok: true,
      lead_id: leadId,
      registration: {
        course_id: target.courseId || '',
        course_slug: target.courseSlug || '',
        course_title: target.courseTitle || '',
        cohort_id: target.cohortId || '',
        payment_status: 'registered'
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to register funnel lead.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/funnel/payment/success', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const payload = await c.req.json();

    const configuredToken = clean(c.env.PAYMENT_WEBHOOK_TOKEN || '', 240);
    const providedToken = clean(c.req.header('x-payment-token') || payload?.webhook_token, 240);
    if (configuredToken && configuredToken !== providedToken) {
      return c.json({ error: 'Unauthorized payment callback.' }, 401);
    }

    const leadIdInput = clean(payload?.lead_id, 64);
    const emailInput = clean(payload?.email, 200).toLowerCase();
    const fullNameInput = clean(payload?.full_name, 120);
    const source = clean(payload?.source, 64) || 'payment';
    const paymentRef = clean(payload?.payment_ref, 120) || `manual_${Date.now()}`;
    const paymentProvider = clean(payload?.payment_provider, 64) || 'manual';
    const amountCents = Number.isFinite(Number(payload?.amount_cents)) ? Number(payload.amount_cents) : 0;
    const currency = clean(payload?.currency, 8).toUpperCase() || 'USD';
    const paymentStatus = clean(payload?.payment_status, 24).toLowerCase() || 'paid';

    if (!PAYMENT_STATUSES.has(paymentStatus)) {
      return c.json({ error: 'Invalid payment_status.' }, 400);
    }

    if (!leadIdInput && !emailInput) {
      return c.json({ error: 'lead_id or email is required.' }, 400);
    }

    let registration = null;
    if (leadIdInput) {
      registration = await c.env.DEEPLEARN_DB.prepare(
        `SELECT
           lead_id, full_name, email, phone, webinar_id, source, session_id, course_id, course_slug, cohort_id, user_id
         FROM lead_registrations
         WHERE lead_id = ?
         LIMIT 1`
      )
        .bind(leadIdInput)
        .first();
    }

    if (!registration && emailInput) {
      registration = await c.env.DEEPLEARN_DB.prepare(
        `SELECT
           lead_id, full_name, email, phone, webinar_id, source, session_id, course_id, course_slug, cohort_id, user_id
         FROM lead_registrations
         WHERE email = ?
         ORDER BY updated_at_ms DESC
         LIMIT 1`
      )
        .bind(emailInput)
        .first();
    }

    const webinarId = clean(payload?.webinar_id, 64) || clean(registration?.webinar_id, 64) || 'deep-rag-live-webinar';
    const sessionId = clean(payload?.session_id, 64) || clean(registration?.session_id, 64) || crypto.randomUUID();
    const fullName = fullNameInput || clean(registration?.full_name, 120);
    const email = emailInput || clean(registration?.email, 200).toLowerCase();
    const phone = clean(payload?.phone, 24) || clean(registration?.phone, 24);

    const target = await resolveLearningTargetByCourse(c.env.DEEPLEARN_DB, {
      courseId: clean(payload?.course_id, 64) || clean(registration?.course_id, 64),
      courseSlug: slugify(clean(payload?.course_slug, 120) || clean(registration?.course_slug, 120)),
      cohortId: clean(payload?.cohort_id, 64) || clean(registration?.cohort_id, 64)
    });

    if (!target.courseId) {
      return c.json({ error: 'Unable to resolve course for payment activation.' }, 400);
    }

    const identityHash = await sha256Hex(email || `${leadIdInput || registration?.lead_id || ''}_${paymentRef}`);
    const userId = clean(payload?.user_id, 120) || clean(registration?.user_id, 120) || `learner_${identityHash.slice(0, 12)}`;
    const displayName = fullName || email || userId;
    const nowMs = Date.now();

    if (paymentStatus === 'paid') {
      await upsertPlatformUser(c.env.DEEPLEARN_DB, { userId, email, displayName, role: 'learner' });
      await upsertCourseEnrollment(c.env.DEEPLEARN_DB, {
        courseId: target.courseId,
        userId,
        status: 'active',
        progressPct: 0,
        certificateUrl: '',
        nowMs
      });

      if (target.cohortId) {
        await upsertCohortEnrollment(c.env.DEEPLEARN_DB, {
          cohortId: target.cohortId,
          courseId: target.courseId,
          userId,
          status: 'enrolled',
          nowMs
        });
        await ensureCohortBootstrapUnlock(c.env.DEEPLEARN_DB, target.cohortId, target.courseId, nowMs);
      }
    }

    const effectiveLeadId = leadIdInput || clean(registration?.lead_id, 64) || crypto.randomUUID();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO lead_registrations (
         lead_id, full_name, email, phone, webinar_id, source, session_id,
         course_id, course_slug, cohort_id, user_id, payment_status, payment_ref, payment_provider,
         paid_at_ms, metadata_json, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(lead_id) DO UPDATE SET
         full_name = excluded.full_name,
         email = excluded.email,
         phone = excluded.phone,
         webinar_id = excluded.webinar_id,
         source = excluded.source,
         session_id = excluded.session_id,
         course_id = excluded.course_id,
         course_slug = excluded.course_slug,
         cohort_id = excluded.cohort_id,
         user_id = excluded.user_id,
         payment_status = excluded.payment_status,
         payment_ref = excluded.payment_ref,
         payment_provider = excluded.payment_provider,
         paid_at_ms = excluded.paid_at_ms,
         metadata_json = excluded.metadata_json,
         updated_at_ms = excluded.updated_at_ms`
    )
      .bind(
        effectiveLeadId,
        fullName,
        email,
        phone,
        webinarId,
        source || clean(registration?.source, 64) || 'payment',
        sessionId,
        target.courseId,
        target.courseSlug,
        target.cohortId,
        userId,
        paymentStatus,
        paymentRef,
        paymentProvider,
        paymentStatus === 'paid' ? nowMs : null,
        JSON.stringify({
          amount_cents: amountCents,
          currency,
          route: '/api/funnel/payment/success'
        }),
        nowMs,
        nowMs
      )
      .run();

    if (paymentStatus === 'paid') {
      await writeGrowthEvent(c.env, c.req.raw.cf, {
        eventName: 'payment_completed',
        webinarId,
        source,
        leadId: effectiveLeadId,
        sessionId,
        path: '/api/funnel/payment/success',
        value: amountCents > 0 ? amountCents / 100 : 1,
        emailHash: email ? await sha256Hex(email) : ''
      });
    }

    return c.json({
      ok: true,
      lead_id: effectiveLeadId,
      payment: {
        status: paymentStatus,
        payment_ref: paymentRef,
        payment_provider: paymentProvider,
        amount_cents: amountCents,
        currency
      },
      enrollment: {
        user_id: userId,
        course_id: target.courseId,
        course_slug: target.courseSlug,
        course_title: target.courseTitle,
        cohort_id: target.cohortId
      },
      next_steps: {
        learner_hub: '/learn',
        access_endpoint: '/api/learn/access?user_id=<firebase_uid>',
        assignment_submit_endpoint: '/api/learn/assignments/:moduleId/submit',
        certificate_rule: 'Certificate issues automatically when course progress reaches 100%.'
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to activate learner after payment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/analytics/funnel', async (c) => {
  try {
    if (!c.env.DEEPLEARN_DB) {
      return c.json({ error: 'Analytics database not configured.' }, 500);
    }

    const webinarId = clean(c.req.query('webinar_id'), 64) || 'deep-rag-live-webinar';
    const days = Math.max(1, Math.min(90, Number(c.req.query('days') || 30)));
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT event_name, COUNT(*) AS event_count
       FROM lead_events
       WHERE webinar_id = ? AND is_likely_bot = 0 AND created_at_ms >= ?
       GROUP BY event_name`
    )
      .bind(webinarId, sinceMs)
      .all();

    const map = Object.create(null);
    for (const row of result.results || []) {
      map[row.event_name] = Number(row.event_count) || 0;
    }

    const landing = map.webinar_landing_view || 0;
    const cta = map.webinar_cta_click || 0;
    const registrations = map.webinar_registration_submitted || 0;
    const paid = map.payment_completed || 0;

    return c.json({
      webinar_id: webinarId,
      days,
      counts: {
        webinar_landing_view: landing,
        webinar_cta_click: cta,
        webinar_registration_started: map.webinar_registration_started || 0,
        webinar_registration_submitted: registrations,
        payment_page_opened: map.payment_page_opened || 0,
        payment_completed: paid
      },
      conversion: {
        ctr_pct: landing > 0 ? Number(((cta / landing) * 100).toFixed(2)) : 0,
        lead_rate_pct: landing > 0 ? Number(((registrations / landing) * 100).toFixed(2)) : 0,
        paid_rate_pct: registrations > 0 ? Number(((paid / registrations) * 100).toFixed(2)) : 0
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to load funnel analytics.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/schema/apply', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    return c.json({ ok: true });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to apply schema.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/overview', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);

    const totalCourses = await scalarCount(c.env.DEEPLEARN_DB, 'SELECT COUNT(*) AS count FROM courses');
    const liveCourses = await scalarCount(c.env.DEEPLEARN_DB, "SELECT COUNT(*) AS count FROM courses WHERE status = 'live'");
    const publishedCourses = await scalarCount(
      c.env.DEEPLEARN_DB,
      "SELECT COUNT(*) AS count FROM courses WHERE status = 'published'"
    );
    const totalTeachers = await scalarCount(
      c.env.DEEPLEARN_DB,
      "SELECT COUNT(DISTINCT user_id) AS count FROM course_staff WHERE role = 'teacher'"
    );
    const totalLearners = await scalarCount(c.env.DEEPLEARN_DB, 'SELECT COUNT(*) AS count FROM course_enrollments');
    const completedLearners = await scalarCount(
      c.env.DEEPLEARN_DB,
      "SELECT COUNT(*) AS count FROM course_enrollments WHERE status = 'completed'"
    );

    return c.json({
      courses: {
        total: totalCourses,
        published: publishedCourses,
        live: liveCourses
      },
      staffing: {
        teachers: totalTeachers
      },
      learners: {
        total: totalLearners,
        completed: completedLearners,
        completion_rate_pct: totalLearners > 0 ? Number(((completedLearners / totalLearners) * 100).toFixed(2)) : 0
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch overview.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/analytics/summary', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const days = Math.max(1, Math.min(365, Number(c.req.query('days') || 30)));
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const registrationRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         COUNT(*) AS registrations,
         SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid
       FROM lead_registrations
       WHERE created_at_ms >= ?`
    )
      .bind(sinceMs)
      .first();

    const paymentRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) AS refunded
       FROM lead_registrations
       WHERE updated_at_ms >= ?`
    )
      .bind(sinceMs)
      .first();

    const learnerRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM course_enrollments`
    ).first();

    const assignmentRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         COUNT(*) AS submitted,
         SUM(CASE WHEN status = 'graded' THEN 1 ELSE 0 END) AS graded,
         SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) AS passed
       FROM assignment_submissions
       WHERE submitted_at_ms >= ?`
    )
      .bind(sinceMs)
      .first();

    const certificateRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT COUNT(*) AS issued
       FROM course_enrollments
       WHERE status = 'completed'
         AND completed_at_ms >= ?`
    )
      .bind(sinceMs)
      .first();

    const registrations = Number(registrationRow?.registrations || 0);
    const paid = Number(paymentRow?.paid || 0);

    return c.json({
      days,
      funnel: {
        registrations,
        paid,
        failed: Number(paymentRow?.failed || 0),
        refunded: Number(paymentRow?.refunded || 0),
        paid_rate_pct: registrations > 0 ? Number(((paid / registrations) * 100).toFixed(2)) : 0
      },
      learners: {
        active: Number(learnerRow?.active || 0),
        completed: Number(learnerRow?.completed || 0)
      },
      assignments: {
        submitted: Number(assignmentRow?.submitted || 0),
        graded: Number(assignmentRow?.graded || 0),
        passed: Number(assignmentRow?.passed || 0)
      },
      certificates: {
        issued_in_window: Number(certificateRow?.issued || 0)
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to load analytics summary.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/analytics/paths', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const days = Math.max(1, Math.min(365, Number(c.req.query('days') || 30)));
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const result = await c.env.DEEPLEARN_DB.prepare(
      `WITH course_path AS (
         SELECT course_id, MIN(path_key) AS path_key
         FROM course_modules
         GROUP BY course_id
       ),
       enrollment_stats AS (
         SELECT
           cp.path_key AS path_key,
           COUNT(*) AS enrollments,
           SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) AS completions,
           ROUND(AVG(e.progress_pct), 2) AS avg_progress_pct
         FROM course_path cp
         LEFT JOIN course_enrollments e ON e.course_id = cp.course_id
         GROUP BY cp.path_key
       ),
       lead_stats AS (
         SELECT
           COALESCE(cp.path_key, 'unmapped') AS path_key,
           COUNT(*) AS leads,
           SUM(CASE WHEN lr.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid
         FROM lead_registrations lr
         LEFT JOIN courses c
           ON c.id = lr.course_id
            OR (lr.course_id = '' AND lr.course_slug <> '' AND c.slug = lr.course_slug)
         LEFT JOIN course_path cp ON cp.course_id = c.id
         WHERE lr.updated_at_ms >= ?
         GROUP BY COALESCE(cp.path_key, 'unmapped')
       )
       SELECT
         p.path_key,
         (SELECT COUNT(DISTINCT cp.course_id) FROM course_path cp WHERE cp.path_key = p.path_key) AS courses,
         (SELECT COUNT(*) FROM course_modules m WHERE m.path_key = p.path_key) AS modules,
         COALESCE(es.enrollments, 0) AS enrollments,
         COALESCE(es.completions, 0) AS completions,
         COALESCE(es.avg_progress_pct, 0) AS avg_progress_pct,
         COALESCE(ls.leads, 0) AS leads,
         COALESCE(ls.paid, 0) AS paid
       FROM (
         SELECT 'productivity' AS path_key
         UNION ALL SELECT 'research'
         UNION ALL SELECT 'entrepreneurship'
       ) p
       LEFT JOIN enrollment_stats es ON es.path_key = p.path_key
       LEFT JOIN lead_stats ls ON ls.path_key = p.path_key`
    )
      .bind(sinceMs)
      .all();

    const paths = (result.results || []).map((row) => {
      const leads = Number(row.leads || 0);
      const paid = Number(row.paid || 0);
      return {
        path_key: clean(row.path_key || '', 40),
        courses: Number(row.courses || 0),
        modules: Number(row.modules || 0),
        enrollments: Number(row.enrollments || 0),
        completions: Number(row.completions || 0),
        avg_progress_pct: Number(row.avg_progress_pct || 0),
        leads,
        paid,
        paid_rate_pct: leads > 0 ? Number(((paid / leads) * 100).toFixed(2)) : 0
      };
    });

    return c.json({ days, paths });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to load path analytics.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/organizations', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 30)));
    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT id, slug, name, brand_primary_color, logo_url, settings_json, created_at_ms, updated_at_ms
       FROM organizations
       ORDER BY updated_at_ms DESC
       LIMIT ?`
    )
      .bind(limit)
      .all();

    const organizations = (result.results || []).map((row) => ({
      ...row,
      settings: parseJsonObjectOrDefault(row.settings_json, {})
    }));

    return c.json({ organizations });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list organizations.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/organizations', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const payload = await c.req.json();
    const slug = slugify(clean(payload?.slug, 120));
    const name = clean(payload?.name, 180);
    const brandPrimaryColor = clean(payload?.brand_primary_color, 16) || '#0f172a';
    const logoUrl = clean(payload?.logo_url, 400);
    const settings =
      payload?.settings && typeof payload.settings === 'object' && !Array.isArray(payload.settings) ? payload.settings : {};

    if (!slug || !name) {
      return c.json({ error: 'slug and name are required.' }, 400);
    }

    const nowMs = Date.now();
    const orgId = crypto.randomUUID();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO organizations (
        id, slug, name, brand_primary_color, logo_url, settings_json, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(orgId, slug, name, brandPrimaryColor, logoUrl, JSON.stringify(settings), nowMs, nowMs)
      .run();

    return c.json({
      ok: true,
      organization: {
        id: orgId,
        slug,
        name,
        brand_primary_color: brandPrimaryColor,
        logo_url: logoUrl,
        settings
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to create organization.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/courses', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 30)));

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         c.id, c.slug, c.title, c.status, c.price_cents, c.start_date, c.end_date, c.created_by, c.created_at_ms, c.updated_at_ms,
         (SELECT COUNT(*) FROM course_staff s WHERE s.course_id = c.id AND s.role = 'teacher') AS teacher_count,
         (SELECT COUNT(*) FROM course_enrollments e WHERE e.course_id = c.id) AS learner_count,
         (SELECT COUNT(*) FROM course_enrollments e WHERE e.course_id = c.id AND e.status = 'completed') AS completed_count
       FROM courses c
       ORDER BY c.created_at_ms DESC
       LIMIT ?`
    )
      .bind(limit)
      .all();

    return c.json({ courses: result.results || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list courses.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const payload = await c.req.json();

    const title = clean(payload?.title, 180);
    const slugInput = clean(payload?.slug, 180);
    const slug = slugInput ? slugify(slugInput) : slugify(title);
    const status = clean(payload?.status, 32) || 'draft';
    const priceCents = Number.isFinite(Number(payload?.price_cents)) ? Number(payload.price_cents) : 0;
    const startDate = clean(payload?.start_date, 40);
    const endDate = clean(payload?.end_date, 40);
    const createdBy = clean(payload?.created_by, 120) || 'coordinator';

    if (!title || !slug) {
      return c.json({ error: 'title is required.' }, 400);
    }

    if (!COURSE_STATUSES.has(status)) {
      return c.json({ error: 'Invalid course status.' }, 400);
    }

    const nowMs = Date.now();
    const courseId = crypto.randomUUID();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO courses (
        id, slug, title, status, price_cents, start_date, end_date, created_by, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(courseId, slug, title, status, priceCents, startDate, endDate, createdBy, nowMs, nowMs)
      .run();

    return c.json({
      ok: true,
      course: {
        id: courseId,
        slug,
        title,
        status,
        price_cents: priceCents,
        start_date: startDate,
        end_date: endDate
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to create course.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses/:courseId/publish', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const payload = await c.req.json();
    const status = clean(payload?.status, 32) || 'published';

    if (!courseId) return c.json({ error: 'courseId is required.' }, 400);
    if (!COURSE_STATUSES.has(status)) return c.json({ error: 'Invalid status.' }, 400);

    await c.env.DEEPLEARN_DB.prepare('UPDATE courses SET status = ?, updated_at_ms = ? WHERE id = ?')
      .bind(status, Date.now(), courseId)
      .run();

    return c.json({ ok: true, course_id: courseId, status });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to update course status.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses/:courseId/staff', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const payload = await c.req.json();
    const role = clean(payload?.role, 40) || 'teacher';
    const userId = clean(payload?.user_id, 120) || `staff_${crypto.randomUUID()}`;
    const email = clean(payload?.email, 220).toLowerCase();
    const displayName = clean(payload?.display_name, 140) || email || 'Teacher';

    if (!courseId) return c.json({ error: 'courseId is required.' }, 400);
    if (!STAFF_ROLES.has(role)) return c.json({ error: 'Invalid staff role.' }, 400);

    await upsertPlatformUser(c.env.DEEPLEARN_DB, { userId, email, displayName, role });

    await c.env.DEEPLEARN_DB.prepare(
      'INSERT OR IGNORE INTO course_staff (course_id, user_id, role, created_at_ms) VALUES (?, ?, ?, ?)'
    )
      .bind(courseId, userId, role, Date.now())
      .run();

    return c.json({ ok: true, course_id: courseId, user_id: userId, role });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to add staff.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/courses/:courseId/modules', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    if (!courseId) return c.json({ error: 'courseId is required.' }, 400);

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         id, course_id, path_key, module_key, title, description, sort_order,
         content_markdown, lab_type, unlock_policy, estimated_minutes, is_published, updated_at_ms
       FROM course_modules
       WHERE course_id = ?
       ORDER BY sort_order ASC, updated_at_ms DESC`
    )
      .bind(courseId)
      .all();

    return c.json({ modules: result.results || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list modules.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses/:courseId/modules', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const payload = await c.req.json();

    const title = clean(payload?.title, 180);
    const moduleKeyInput = clean(payload?.module_key, 120);
    const moduleKey = moduleKeyInput ? slugify(moduleKeyInput) : slugify(title);
    const description = clean(payload?.description, 1200);
    const pathKey = clean(payload?.path_key, 40).toLowerCase() || 'productivity';
    const sortOrder = Number.isFinite(Number(payload?.sort_order)) ? Number(payload.sort_order) : null;
    const contentMarkdown = typeof payload?.content_markdown === 'string' ? payload.content_markdown.slice(0, 20000) : '';
    const labType = clean(payload?.lab_type, 80);
    const unlockPolicy = clean(payload?.unlock_policy, 40) || 'cohort';
    const estimatedMinutes = Number.isFinite(Number(payload?.estimated_minutes)) ? Number(payload.estimated_minutes) : 30;
    const isPublished = payload?.is_published === true ? 1 : 0;

    if (!courseId || !title || !moduleKey) {
      return c.json({ error: 'courseId, title, and module_key are required.' }, 400);
    }
    if (!PATH_KEYS.has(pathKey)) {
      return c.json({ error: 'Invalid path_key.' }, 400);
    }

    let resolvedSortOrder = sortOrder;
    if (resolvedSortOrder === null) {
      const row = await c.env.DEEPLEARN_DB.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM course_modules WHERE course_id = ?'
      )
        .bind(courseId)
        .first();
      resolvedSortOrder = Number(row?.next_sort || 0);
    }

    const nowMs = Date.now();
    const moduleId = crypto.randomUUID();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO course_modules (
         id, course_id, path_key, module_key, title, description, sort_order,
         content_markdown, lab_type, unlock_policy, estimated_minutes, is_published, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        moduleId,
        courseId,
        pathKey,
        moduleKey,
        title,
        description,
        resolvedSortOrder,
        contentMarkdown,
        labType,
        unlockPolicy,
        estimatedMinutes,
        isPublished,
        nowMs,
        nowMs
      )
      .run();

    return c.json({
      ok: true,
      module: {
        id: moduleId,
        course_id: courseId,
        path_key: pathKey,
        module_key: moduleKey,
        title,
        description,
        sort_order: resolvedSortOrder,
        lab_type: labType,
        unlock_policy: unlockPolicy,
        estimated_minutes: estimatedMinutes,
        is_published: isPublished
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to create module.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/courses/:courseId/rubrics', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const moduleId = clean(c.req.query('module_id'), 64);
    if (!courseId) return c.json({ error: 'courseId is required.' }, 400);

    const whereClause = moduleId ? 'WHERE course_id = ? AND module_id = ?' : 'WHERE course_id = ?';
    const result = moduleId
      ? await c.env.DEEPLEARN_DB.prepare(
          `SELECT id, course_id, module_id, title, rubric_json, pass_threshold, updated_at_ms
           FROM assignment_rubrics
           ${whereClause}
           ORDER BY updated_at_ms DESC`
        )
          .bind(courseId, moduleId)
          .all()
      : await c.env.DEEPLEARN_DB.prepare(
          `SELECT id, course_id, module_id, title, rubric_json, pass_threshold, updated_at_ms
           FROM assignment_rubrics
           ${whereClause}
           ORDER BY updated_at_ms DESC`
        )
          .bind(courseId)
          .all();

    const rubrics = (result.results || []).map((row) => ({
      ...row,
      rubric: parseJsonObjectOrDefault(row.rubric_json, {})
    }));

    return c.json({ rubrics });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list rubrics.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses/:courseId/rubrics', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const payload = await c.req.json();
    const moduleId = clean(payload?.module_id, 64);
    const title = clean(payload?.title, 200);
    const passThreshold = Number.isFinite(Number(payload?.pass_threshold)) ? Number(payload.pass_threshold) : 70;
    const rubric = payload?.rubric && typeof payload.rubric === 'object' && !Array.isArray(payload.rubric) ? payload.rubric : {};

    if (!courseId || !moduleId || !title) {
      return c.json({ error: 'courseId, module_id, and title are required.' }, 400);
    }

    const nowMs = Date.now();
    const rubricId = crypto.randomUUID();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO assignment_rubrics (
         id, course_id, module_id, title, rubric_json, pass_threshold, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(rubricId, courseId, moduleId, title, JSON.stringify(rubric), passThreshold, nowMs, nowMs)
      .run();

    return c.json({
      ok: true,
      rubric: {
        id: rubricId,
        course_id: courseId,
        module_id: moduleId,
        title,
        pass_threshold: passThreshold,
        rubric
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to create rubric.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/rubrics/:rubricId', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const rubricId = clean(c.req.param('rubricId'), 64);
    const payload = await c.req.json();
    const title = clean(payload?.title, 200);
    const passThreshold = Number.isFinite(Number(payload?.pass_threshold)) ? Number(payload.pass_threshold) : 70;
    const rubric = payload?.rubric && typeof payload.rubric === 'object' && !Array.isArray(payload.rubric) ? payload.rubric : null;

    if (!rubricId) return c.json({ error: 'rubricId is required.' }, 400);

    await c.env.DEEPLEARN_DB.prepare(
      `UPDATE assignment_rubrics
       SET title = CASE WHEN ? <> '' THEN ? ELSE title END,
           rubric_json = CASE WHEN ? IS NOT NULL THEN ? ELSE rubric_json END,
           pass_threshold = ?,
           updated_at_ms = ?
       WHERE id = ?`
    )
      .bind(title, title, rubric ? 1 : null, rubric ? JSON.stringify(rubric) : '', passThreshold, Date.now(), rubricId)
      .run();

    return c.json({ ok: true, rubric_id: rubricId });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to update rubric.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/cohorts', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 40)));
    const courseId = clean(c.req.query('course_id'), 64);
    const orgId = clean(c.req.query('org_id'), 64);
    const status = clean(c.req.query('status'), 32).toLowerCase();

    const conditions = [];
    const params = [];

    if (courseId) {
      conditions.push('co.course_id = ?');
      params.push(courseId);
    }
    if (orgId) {
      conditions.push('co.org_id = ?');
      params.push(orgId);
    }
    if (status) {
      conditions.push('co.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT
        co.id, co.org_id, co.course_id, co.name, co.mode, co.start_date, co.end_date, co.instructor_user_id,
        co.fee_cents, co.status, co.updated_at_ms,
        c.title AS course_title,
        (SELECT COUNT(*) FROM cohort_enrollments e WHERE e.cohort_id = co.id) AS learner_count
      FROM cohorts co
      LEFT JOIN courses c ON c.id = co.course_id
      ${whereClause}
      ORDER BY co.updated_at_ms DESC
      LIMIT ?`;

    params.push(limit);
    const result = await c.env.DEEPLEARN_DB.prepare(query)
      .bind(...params)
      .all();

    return c.json({ cohorts: result.results || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list cohorts.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/cohorts', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const payload = await c.req.json();
    const courseId = clean(payload?.course_id, 64);
    const orgId = clean(payload?.org_id, 64);
    const name = clean(payload?.name, 180);
    const mode = clean(payload?.mode, 40).toLowerCase() || 'instructor-led';
    const status = clean(payload?.status, 32).toLowerCase() || 'draft';
    const startDate = clean(payload?.start_date, 40);
    const endDate = clean(payload?.end_date, 40);
    const instructorUserId = clean(payload?.instructor_user_id, 120);
    const feeCents = Number.isFinite(Number(payload?.fee_cents)) ? Number(payload.fee_cents) : 0;

    if (!courseId || !name) {
      return c.json({ error: 'course_id and name are required.' }, 400);
    }
    if (!COHORT_MODES.has(mode)) {
      return c.json({ error: 'Invalid cohort mode.' }, 400);
    }
    if (!COHORT_STATUSES.has(status)) {
      return c.json({ error: 'Invalid cohort status.' }, 400);
    }

    const nowMs = Date.now();
    const cohortId = crypto.randomUUID();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO cohorts (
         id, org_id, course_id, name, mode, start_date, end_date, instructor_user_id, fee_cents, status, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(cohortId, orgId, courseId, name, mode, startDate, endDate, instructorUserId, feeCents, status, nowMs, nowMs)
      .run();

    return c.json({
      ok: true,
      cohort: {
        id: cohortId,
        org_id: orgId,
        course_id: courseId,
        name,
        mode,
        status,
        start_date: startDate,
        end_date: endDate,
        instructor_user_id: instructorUserId,
        fee_cents: feeCents
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to create cohort.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/cohorts/:cohortId/unlocks', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const cohortId = clean(c.req.param('cohortId'), 64);
    if (!cohortId) return c.json({ error: 'cohortId is required.' }, 400);

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         u.cohort_id, u.module_id, u.created_at_ms,
         m.module_key, m.title
       FROM cohort_module_unlocks u
       LEFT JOIN course_modules m ON m.id = u.module_id
       WHERE u.cohort_id = ?
       ORDER BY u.created_at_ms ASC`
    )
      .bind(cohortId)
      .all();

    return c.json({ unlocks: result.results || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list cohort unlocks.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/cohorts/:cohortId/unlocks', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const cohortId = clean(c.req.param('cohortId'), 64);
    const payload = await c.req.json();
    let moduleId = clean(payload?.module_id, 64);
    const moduleKey = slugify(clean(payload?.module_key, 120));

    if (!cohortId) return c.json({ error: 'cohortId is required.' }, 400);

    if (!moduleId && moduleKey) {
      const cohort = await c.env.DEEPLEARN_DB.prepare('SELECT course_id FROM cohorts WHERE id = ?').bind(cohortId).first();
      const resolvedModule = await c.env.DEEPLEARN_DB.prepare(
        'SELECT id FROM course_modules WHERE course_id = ? AND module_key = ? LIMIT 1'
      )
        .bind(clean(cohort?.course_id || '', 64), moduleKey)
        .first();
      moduleId = clean(resolvedModule?.id || '', 64);
    }

    if (!moduleId) {
      return c.json({ error: 'module_id (or module_key resolvable in this cohort course) is required.' }, 400);
    }

    await c.env.DEEPLEARN_DB.prepare(
      'INSERT OR IGNORE INTO cohort_module_unlocks (cohort_id, module_id, created_at_ms) VALUES (?, ?, ?)'
    )
      .bind(cohortId, moduleId, Date.now())
      .run();

    return c.json({ ok: true, cohort_id: cohortId, module_id: moduleId });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to unlock module for cohort.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/cohorts/:cohortId/enrollments', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const cohortId = clean(c.req.param('cohortId'), 64);
    if (!cohortId) return c.json({ error: 'cohortId is required.' }, 400);

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         e.cohort_id, e.course_id, e.user_id, e.status, e.progress_pct, e.completion_state,
         e.completed_at_ms, e.certificate_url, e.updated_at_ms,
         u.email, u.display_name
       FROM cohort_enrollments e
       LEFT JOIN platform_users u ON u.uid = e.user_id
       WHERE e.cohort_id = ?
       ORDER BY e.updated_at_ms DESC`
    )
      .bind(cohortId)
      .all();

    return c.json({ enrollments: result.results || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list cohort enrollments.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/cohorts/:cohortId/enroll', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const cohortId = clean(c.req.param('cohortId'), 64);
    const payload = await c.req.json();
    const userId = clean(payload?.user_id, 120) || `learner_${crypto.randomUUID()}`;
    const email = clean(payload?.email, 220).toLowerCase();
    const displayName = clean(payload?.display_name, 140) || email || 'Learner';
    const status = clean(payload?.status, 32).toLowerCase() || 'enrolled';

    if (!cohortId) return c.json({ error: 'cohortId is required.' }, 400);

    const cohort = await c.env.DEEPLEARN_DB.prepare('SELECT course_id FROM cohorts WHERE id = ?').bind(cohortId).first();
    const courseId = clean(cohort?.course_id || '', 64);
    if (!courseId) return c.json({ error: 'Cohort not found or missing course_id.' }, 404);

    await upsertPlatformUser(c.env.DEEPLEARN_DB, { userId, email, displayName, role: 'learner' });

    const nowMs = Date.now();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO cohort_enrollments (
         cohort_id, course_id, user_id, status, progress_pct, completion_state, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, 0, 'in_progress', NULL, '', ?, ?)
       ON CONFLICT(cohort_id, user_id) DO UPDATE SET
         status = excluded.status,
         updated_at_ms = excluded.updated_at_ms`
    )
      .bind(cohortId, courseId, userId, status, nowMs, nowMs)
      .run();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO course_enrollments (
         course_id, user_id, status, progress_pct, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
       ) VALUES (?, ?, 'active', 0, NULL, '', ?, ?)
       ON CONFLICT(course_id, user_id) DO UPDATE SET
         updated_at_ms = excluded.updated_at_ms`
    )
      .bind(courseId, userId, nowMs, nowMs)
      .run();

    return c.json({ ok: true, cohort_id: cohortId, course_id: courseId, user_id: userId, status });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to enroll learner into cohort.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/cohorts/:cohortId/enroll/:userId/complete', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const cohortId = clean(c.req.param('cohortId'), 64);
    const userId = clean(c.req.param('userId'), 120);
    const payload = await c.req.json();
    const certificateUrl = clean(payload?.certificate_url, 400);
    const nowMs = Date.now();

    if (!cohortId || !userId) {
      return c.json({ error: 'cohortId and userId are required.' }, 400);
    }

    const cohort = await c.env.DEEPLEARN_DB.prepare('SELECT course_id FROM cohorts WHERE id = ?').bind(cohortId).first();
    const courseId = clean(cohort?.course_id || '', 64);

    await c.env.DEEPLEARN_DB.prepare(
      `UPDATE cohort_enrollments
       SET status = 'completed',
           progress_pct = 100,
           completion_state = 'completed',
           completed_at_ms = ?,
           certificate_url = ?,
           updated_at_ms = ?
       WHERE cohort_id = ? AND user_id = ?`
    )
      .bind(nowMs, certificateUrl, nowMs, cohortId, userId)
      .run();

    if (courseId) {
      await c.env.DEEPLEARN_DB.prepare(
        `UPDATE course_enrollments
         SET status = 'completed',
             progress_pct = 100,
             completed_at_ms = ?,
             certificate_url = ?,
             updated_at_ms = ?
         WHERE course_id = ? AND user_id = ?`
      )
        .bind(nowMs, certificateUrl, nowMs, courseId, userId)
        .run();
    }

    return c.json({
      ok: true,
      cohort_id: cohortId,
      course_id: courseId,
      user_id: userId,
      status: 'completed',
      certificate_url: certificateUrl
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to complete cohort enrollment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/learn/modules/:moduleId/progress', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const moduleId = clean(c.req.param('moduleId'), 64);
    const payload = await c.req.json();
    const userId = clean(payload?.user_id, 120);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    const actorAccessError = assertActorCanAccessUser(actor, userId, { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;
    const courseId = clean(payload?.course_id, 64);
    const cohortId = clean(payload?.cohort_id, 64);
    const status = clean(payload?.status, 32).toLowerCase();
    const score = Number.isFinite(Number(payload?.score)) ? Number(payload.score) : null;
    const artifactUrl = clean(payload?.artifact_url, 400);
    const notes = clean(payload?.notes, 2000);

    if (!moduleId || !userId || !courseId || !status) {
      return c.json({ error: 'moduleId, user_id, course_id, and status are required.' }, 400);
    }
    if (!MODULE_PROGRESS_STATUSES.has(status)) {
      return c.json({ error: 'Invalid module progress status.' }, 400);
    }

    const nowMs = Date.now();
    const existing = await c.env.DEEPLEARN_DB.prepare(
      `SELECT attempt_count FROM module_progress
       WHERE course_id = ? AND module_id = ? AND user_id = ?`
    )
      .bind(courseId, moduleId, userId)
      .first();
    const nextAttemptCount = Math.max(1, Number(existing?.attempt_count || 0) + (status === 'submitted' ? 1 : 0));

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO module_progress (
         cohort_id, course_id, module_id, user_id, status, score, attempt_count, artifact_url, notes, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(course_id, module_id, user_id) DO UPDATE SET
         cohort_id = excluded.cohort_id,
         status = excluded.status,
         score = excluded.score,
         attempt_count = excluded.attempt_count,
         artifact_url = excluded.artifact_url,
         notes = excluded.notes,
         updated_at_ms = excluded.updated_at_ms`
    )
      .bind(cohortId, courseId, moduleId, userId, status, score, nextAttemptCount, artifactUrl, notes, nowMs)
      .run();

    const totalModulesRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT COUNT(*) AS count FROM course_modules WHERE course_id = ? AND is_published = 1`
    )
      .bind(courseId)
      .first();
    let totalModules = Number(totalModulesRow?.count || 0);
    if (totalModules === 0) {
      const anyModuleRow = await c.env.DEEPLEARN_DB.prepare(
        `SELECT COUNT(*) AS count FROM course_modules WHERE course_id = ?`
      )
        .bind(courseId)
        .first();
      totalModules = Number(anyModuleRow?.count || 0);
    }
    const completedRow = await c.env.DEEPLEARN_DB.prepare(
      `SELECT COUNT(*) AS count
       FROM module_progress
       WHERE course_id = ? AND user_id = ? AND status IN ('completed', 'passed')`
    )
      .bind(courseId, userId)
      .first();
    const completedModules = Number(completedRow?.count || 0);
    const progressPct = totalModules > 0 ? Number(((completedModules / totalModules) * 100).toFixed(2)) : 0;
    const currentEnrollment = await c.env.DEEPLEARN_DB.prepare(
      `SELECT status, completed_at_ms, certificate_url
       FROM course_enrollments
       WHERE course_id = ? AND user_id = ?
       LIMIT 1`
    )
      .bind(courseId, userId)
      .first();
    const enrollmentWasCompleted = clean(currentEnrollment?.status || '', 32) === 'completed';
    const reachedCompletion = progressPct >= 100;
    const enrollmentStatus = enrollmentWasCompleted || reachedCompletion ? 'completed' : 'active';
    const completionMs =
      enrollmentStatus === 'completed'
        ? Number(currentEnrollment?.completed_at_ms || 0) || nowMs
        : null;
    let certificateUrl = clean(currentEnrollment?.certificate_url || '', 400);
    if (enrollmentStatus === 'completed' && !certificateUrl) {
      certificateUrl = buildCertificateUrl(c.env, { courseId, userId, issuedAtMs: completionMs || nowMs });
    }

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO course_enrollments (
         course_id, user_id, status, progress_pct, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(course_id, user_id) DO UPDATE SET
         status = excluded.status,
         progress_pct = excluded.progress_pct,
         completed_at_ms = excluded.completed_at_ms,
         certificate_url = excluded.certificate_url,
         updated_at_ms = excluded.updated_at_ms`
    )
      .bind(courseId, userId, enrollmentStatus, progressPct, completionMs, certificateUrl, nowMs, nowMs)
      .run();

    if (cohortId) {
      const cohortRow = await c.env.DEEPLEARN_DB.prepare(
        `SELECT status, completed_at_ms, certificate_url
         FROM cohort_enrollments
         WHERE cohort_id = ? AND user_id = ?
         LIMIT 1`
      )
        .bind(cohortId, userId)
        .first();
      const cohortCompleted = clean(cohortRow?.status || '', 32) === 'completed' || reachedCompletion;
      const completionState = cohortCompleted ? 'completed' : 'in_progress';
      const cohortStatus = cohortCompleted ? 'completed' : 'enrolled';
      const cohortCompletionMs = cohortCompleted ? Number(cohortRow?.completed_at_ms || 0) || nowMs : null;
      const cohortCertificateUrl = cohortCompleted
        ? clean(cohortRow?.certificate_url || '', 400) || certificateUrl
        : clean(cohortRow?.certificate_url || '', 400);
      await c.env.DEEPLEARN_DB.prepare(
        `INSERT INTO cohort_enrollments (
           cohort_id, course_id, user_id, status, progress_pct, completion_state, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cohort_id, user_id) DO UPDATE SET
           status = excluded.status,
           progress_pct = excluded.progress_pct,
           completion_state = excluded.completion_state,
           completed_at_ms = excluded.completed_at_ms,
           certificate_url = excluded.certificate_url,
           updated_at_ms = excluded.updated_at_ms`
      )
        .bind(
          cohortId,
          courseId,
          userId,
          cohortStatus,
          progressPct,
          completionState,
          cohortCompletionMs,
          cohortCertificateUrl,
          nowMs,
          nowMs
        )
        .run();
    }

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO learning_events (
         org_id, course_id, module_id, cohort_id, user_id, event_name, event_value, metadata_json, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('', courseId, moduleId, cohortId, userId, 'module_progress_updated', 1, JSON.stringify({ status, score }), nowMs)
      .run();

    if (!enrollmentWasCompleted && enrollmentStatus === 'completed') {
      await c.env.DEEPLEARN_DB.prepare(
        `INSERT INTO assessment_events (
           org_id, course_id, module_id, cohort_id, user_id, event_name, score, passed, metadata_json, created_at_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          '',
          courseId,
          moduleId,
          cohortId,
          userId,
          'certificate_issued',
          100,
          1,
          JSON.stringify({ certificate_url: certificateUrl }),
          nowMs
        )
        .run();
    }

    return c.json({
      ok: true,
      progress: {
        course_id: courseId,
        cohort_id: cohortId,
        module_id: moduleId,
        user_id: userId,
        status,
        score,
        progress_pct: progressPct,
        enrollment_status: enrollmentStatus,
        certificate_url: certificateUrl
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to update module progress.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/learn/access', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const userId = clean(c.req.query('user_id'), 120);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    const actorAccessError = assertActorCanAccessUser(actor, userId, { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;
    if (!userId) return c.json({ error: 'user_id is required.' }, 400);

    const enrollments = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         e.course_id, e.status, e.progress_pct, e.completed_at_ms, e.certificate_url, e.updated_at_ms,
         c.slug, c.title, c.status AS course_status
       FROM course_enrollments e
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ?
       ORDER BY e.updated_at_ms DESC`
    )
      .bind(userId)
      .all();

    const items = [];
    for (const enrollment of enrollments.results || []) {
      const cohortRow = await c.env.DEEPLEARN_DB.prepare(
        `SELECT cohort_id, status, progress_pct, completion_state, certificate_url
         FROM cohort_enrollments
         WHERE user_id = ? AND course_id = ?
         ORDER BY updated_at_ms DESC
         LIMIT 1`
      )
        .bind(userId, clean(enrollment.course_id || '', 64))
        .first();

      const cohortId = clean(cohortRow?.cohort_id || '', 64);
      const modules = await c.env.DEEPLEARN_DB.prepare(
        `SELECT
           m.id, m.module_key, m.title, m.sort_order, m.is_published,
           CASE
             WHEN ? = '' THEN 1
             WHEN EXISTS (
               SELECT 1 FROM cohort_module_unlocks u
               WHERE u.cohort_id = ? AND u.module_id = m.id
             ) THEN 1
             ELSE 0
           END AS is_unlocked
         FROM course_modules m
         WHERE m.course_id = ?
         ORDER BY m.sort_order ASC, m.updated_at_ms DESC`
      )
        .bind(cohortId, cohortId, clean(enrollment.course_id || '', 64))
        .all();

      items.push({
        course_id: enrollment.course_id,
        course_slug: clean(enrollment.slug || '', 120),
        course_title: clean(enrollment.title || '', 180),
        course_status: clean(enrollment.course_status || '', 32),
        enrollment_status: clean(enrollment.status || '', 32),
        progress_pct: Number(enrollment.progress_pct || 0),
        completed_at_ms: Number(enrollment.completed_at_ms || 0),
        certificate_url: clean(enrollment.certificate_url || '', 400),
        cohort: {
          cohort_id: cohortId,
          status: clean(cohortRow?.status || '', 32),
          completion_state: clean(cohortRow?.completion_state || '', 40),
          progress_pct: Number(cohortRow?.progress_pct || 0),
          certificate_url: clean(cohortRow?.certificate_url || '', 400)
        },
        modules: (modules.results || []).map((module) => ({
          id: module.id,
          module_key: module.module_key,
          title: module.title,
          sort_order: module.sort_order,
          is_published: Number(module.is_published || 0) === 1,
          is_unlocked: Number(module.is_unlocked || 0) === 1
        }))
      });
    }

    return c.json({ user_id: userId, access: items });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to load learner access.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/lab/run', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const payload = await c.req.json();
    const userId = clean(payload?.user_id, 120);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    const actorAccessError = assertActorCanAccessUser(actor, userId, { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;

    const courseId = clean(payload?.course_id, 64);
    const moduleId = clean(payload?.module_id, 64);
    const pathKey = clean(payload?.path_key, 40).toLowerCase();
    const toolType = clean(payload?.tool_type, 80);
    const provider = clean(payload?.provider, 80);
    const modelName = clean(payload?.model_name, 120);
    const input = typeof payload?.input === 'string' ? payload.input.slice(0, 8000) : '';

    if (!userId || !courseId || !moduleId || !pathKey || !toolType || !input.trim()) {
      return c.json({ error: 'user_id, course_id, module_id, path_key, tool_type, and input are required.' }, 400);
    }
    if (!PATH_KEYS.has(pathKey)) {
      return c.json({ error: 'Invalid path_key.' }, 400);
    }

    const startedAt = Date.now();
    const inputHash = await sha256Hex(input);
    const sampleOutput = generateLabRunOutput({ pathKey, toolType, modelName, input });
    const latencyMs = Date.now() - startedAt;
    const runId = crypto.randomUUID();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO lab_runs (
         id, org_id, course_id, module_id, user_id, path_key, tool_type, provider, model_name,
         input_hash, output_json, latency_ms, cost_microunits, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        runId,
        '',
        courseId,
        moduleId,
        userId,
        pathKey,
        toolType,
        provider,
        modelName,
        inputHash,
        JSON.stringify(sampleOutput),
        latencyMs,
        0,
        Date.now()
      )
      .run();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO learning_events (
         org_id, course_id, module_id, cohort_id, user_id, event_name, event_value, metadata_json, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('', courseId, moduleId, clean(payload?.cohort_id, 64), userId, 'lab_run_completed', 1, JSON.stringify({ run_id: runId, tool_type: toolType, provider, model_name: modelName }), Date.now())
      .run();

    return c.json({
      ok: true,
      run: {
        id: runId,
        course_id: courseId,
        module_id: moduleId,
        user_id: userId,
        path_key: pathKey,
        tool_type: toolType,
        provider,
        model_name: modelName,
        latency_ms: latencyMs,
        output: sampleOutput
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to run lab experiment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/lab/runs', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;

    const requestedUserId = clean(c.req.query('user_id'), 120);
    const courseId = clean(c.req.query('course_id'), 64);
    const moduleId = clean(c.req.query('module_id'), 64);
    const pathKey = clean(c.req.query('path_key'), 40).toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 20)));

    const targetUserId = requestedUserId || actor.userId;
    const actorAccessError = assertActorCanAccessUser(actor, targetUserId, { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;

    const conditions = ['user_id = ?'];
    const params = [targetUserId];
    if (courseId) {
      conditions.push('course_id = ?');
      params.push(courseId);
    }
    if (moduleId) {
      conditions.push('module_id = ?');
      params.push(moduleId);
    }
    if (pathKey && PATH_KEYS.has(pathKey)) {
      conditions.push('path_key = ?');
      params.push(pathKey);
    }
    params.push(limit);

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         id, course_id, module_id, user_id, path_key, tool_type, provider, model_name,
         output_json, latency_ms, cost_microunits, created_at_ms
       FROM lab_runs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at_ms DESC
       LIMIT ?`
    )
      .bind(...params)
      .all();

    const runs = (result.results || []).map((row) => ({
      ...row,
      output: parseJsonObjectOrDefault(row.output_json, {})
    }));

    return c.json({ runs });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list lab runs.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/learn/capstone/submit', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const payload = await c.req.json();
    const userId = clean(payload?.user_id, 120);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    const actorAccessError = assertActorCanAccessUser(actor, userId, { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;

    const courseId = clean(payload?.course_id, 64);
    const moduleId = clean(payload?.module_id, 64);
    const cohortId = clean(payload?.cohort_id, 64);
    const pathKey = clean(payload?.path_key, 40).toLowerCase() || 'entrepreneurship';
    const title = clean(payload?.title, 220);
    const summary = typeof payload?.summary === 'string' ? payload.summary.slice(0, 4000) : '';
    const artifactUrl = clean(payload?.artifact_url, 500);
    const pitchDeckUrl = clean(payload?.pitch_deck_url, 500);
    const dataRoomUrl = clean(payload?.data_room_url, 500);

    if (!userId || !courseId || !moduleId || !title) {
      return c.json({ error: 'user_id, course_id, module_id, and title are required.' }, 400);
    }
    if (!PATH_KEYS.has(pathKey)) {
      return c.json({ error: 'Invalid path_key.' }, 400);
    }

    const artifactId = crypto.randomUUID();
    const nowMs = Date.now();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO capstone_artifacts (
         id, course_id, module_id, cohort_id, user_id, path_key, title, summary, artifact_url, pitch_deck_url,
         data_room_url, status, score, feedback_json, submitted_at_ms, reviewed_at_ms, reviewer_id, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NULL, '{}', ?, NULL, '', ?)`
    )
      .bind(
        artifactId,
        courseId,
        moduleId,
        cohortId,
        userId,
        pathKey,
        title,
        summary,
        artifactUrl,
        pitchDeckUrl,
        dataRoomUrl,
        nowMs,
        nowMs
      )
      .run();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO assessment_events (
         org_id, course_id, module_id, cohort_id, user_id, event_name, score, passed, metadata_json, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('', courseId, moduleId, cohortId, userId, 'capstone_submitted', null, 0, JSON.stringify({ artifact_id: artifactId }), nowMs)
      .run();

    return c.json({
      ok: true,
      artifact: {
        id: artifactId,
        course_id: courseId,
        module_id: moduleId,
        cohort_id: cohortId,
        user_id: userId,
        path_key: pathKey,
        title,
        status: 'submitted'
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to submit capstone artifact.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/learn/capstone/artifacts', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;

    const requestedUserId = clean(c.req.query('user_id'), 120);
    const courseId = clean(c.req.query('course_id'), 64);
    const status = clean(c.req.query('status'), 32);
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 30)));
    const canReview = actor.isAdmin || hasAnyRole(actor.roles, ['teacher', 'coordinator', 'cto']);
    const targetUserId = requestedUserId || (canReview ? '' : actor.userId);

    if (targetUserId) {
      const actorAccessError = assertActorCanAccessUser(actor, targetUserId, { allowPrivileged: true });
      if (actorAccessError) return actorAccessError;
    }

    const conditions = [];
    const params = [];
    if (targetUserId) {
      conditions.push('a.user_id = ?');
      params.push(targetUserId);
    }
    if (courseId) {
      conditions.push('a.course_id = ?');
      params.push(courseId);
    }
    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         a.id, a.course_id, a.module_id, a.cohort_id, a.user_id, a.path_key, a.title, a.summary, a.artifact_url,
         a.pitch_deck_url, a.data_room_url, a.status, a.score, a.feedback_json, a.submitted_at_ms, a.reviewed_at_ms,
         a.reviewer_id, a.updated_at_ms, c.title AS course_title
       FROM capstone_artifacts a
       LEFT JOIN courses c ON c.id = a.course_id
       ${whereClause}
       ORDER BY a.updated_at_ms DESC
       LIMIT ?`
    )
      .bind(...params)
      .all();

    const artifacts = (result.results || []).map((row) => ({
      ...row,
      feedback: parseJsonObjectOrDefault(row.feedback_json, {})
    }));

    return c.json({ can_review: canReview, artifacts });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list capstone artifacts.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/learn/capstone/:artifactId/review', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    if (!actor.isAdmin && !hasAnyRole(actor.roles, ['teacher', 'coordinator', 'cto'])) {
      return c.json({ error: 'Review permission denied.' }, 403);
    }

    const artifactId = clean(c.req.param('artifactId'), 64);
    const payload = await c.req.json();
    const scoreInput = Number(payload?.score);
    const score = Number.isFinite(scoreInput) ? Math.max(0, Math.min(100, scoreInput)) : null;
    const feedbackText = clean(payload?.feedback, 2000);
    const status = clean(payload?.status, 32).toLowerCase() || 'reviewed';
    const passed = typeof payload?.passed === 'boolean' ? payload.passed : score !== null ? score >= 70 : false;

    if (!artifactId) return c.json({ error: 'artifactId is required.' }, 400);
    if (!new Set(['reviewed', 'accepted', 'rejected', 'needs_revision']).has(status)) {
      return c.json({ error: 'Invalid review status.' }, 400);
    }

    const nowMs = Date.now();
    const artifact = await c.env.DEEPLEARN_DB.prepare(
      `SELECT id, course_id, module_id, cohort_id, user_id, title
       FROM capstone_artifacts
       WHERE id = ?
       LIMIT 1`
    )
      .bind(artifactId)
      .first();
    if (!artifact) return c.json({ error: 'Artifact not found.' }, 404);

    await c.env.DEEPLEARN_DB.prepare(
      `UPDATE capstone_artifacts
       SET status = ?, score = ?, feedback_json = ?, reviewed_at_ms = ?, reviewer_id = ?, updated_at_ms = ?
       WHERE id = ?`
    )
      .bind(
        status,
        score,
        JSON.stringify({ feedback: feedbackText, passed }),
        nowMs,
        actor.userId || 'system',
        nowMs,
        artifactId
      )
      .run();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO assessment_events (
         org_id, course_id, module_id, cohort_id, user_id, event_name, score, passed, metadata_json, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        '',
        clean(artifact.course_id || '', 64),
        clean(artifact.module_id || '', 64),
        clean(artifact.cohort_id || '', 64),
        clean(artifact.user_id || '', 120),
        'capstone_reviewed',
        score,
        passed ? 1 : 0,
        JSON.stringify({ artifact_id: artifactId, status, reviewer_id: actor.userId || 'system' }),
        nowMs
      )
      .run();

    return c.json({
      ok: true,
      review: {
        artifact_id: artifactId,
        status,
        score,
        passed,
        reviewer_id: actor.userId || 'system'
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to review capstone artifact.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/learn/assignments/:moduleId/submit', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const moduleId = clean(c.req.param('moduleId'), 64);
    const payload = await c.req.json();
    const userId = clean(payload?.user_id, 120);
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    const actorAccessError = assertActorCanAccessUser(actor, userId, { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;
    const courseId = clean(payload?.course_id, 64);
    const rubricId = clean(payload?.rubric_id, 64);
    const answerText = typeof payload?.answer_text === 'string' ? payload.answer_text.slice(0, 15000) : '';
    const artifacts = Array.isArray(payload?.artifacts_json) ? payload.artifacts_json : [];

    if (!moduleId || !userId || !courseId || !answerText.trim()) {
      return c.json({ error: 'moduleId, user_id, course_id, and answer_text are required.' }, 400);
    }

    const submissionId = crypto.randomUUID();
    const nowMs = Date.now();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO assignment_submissions (
         id, course_id, module_id, user_id, rubric_id, answer_text, artifacts_json, ai_feedback_json,
         score, passed, submitted_at_ms, graded_at_ms, grader_mode, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', NULL, 0, ?, NULL, 'ai', 'submitted')`
    )
      .bind(submissionId, courseId, moduleId, userId, rubricId, answerText, JSON.stringify(artifacts), nowMs)
      .run();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO learning_events (
         org_id, course_id, module_id, cohort_id, user_id, event_name, event_value, metadata_json, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('', courseId, moduleId, '', userId, 'assignment_submitted', 1, JSON.stringify({ submission_id: submissionId }), nowMs)
      .run();

    return c.json({
      ok: true,
      submission: {
        id: submissionId,
        course_id: courseId,
        module_id: moduleId,
        user_id: userId,
        status: 'submitted',
        submitted_at_ms: nowMs
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to submit assignment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/learn/assignments/:submissionId/grade', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const submissionId = clean(c.req.param('submissionId'), 64);
    const payload = await c.req.json();
    const actor = await resolveActorContext(c, { requireUser: true });
    if (actor.error) return actor.error;
    const groqKey = clean(payload?.groq_key, 240);
    if (!submissionId) return c.json({ error: 'submissionId is required.' }, 400);

    const submission = await c.env.DEEPLEARN_DB.prepare(
      `SELECT id, course_id, module_id, user_id, rubric_id, answer_text
       FROM assignment_submissions
       WHERE id = ? LIMIT 1`
    )
      .bind(submissionId)
      .first();
    if (!submission) return c.json({ error: 'Submission not found.' }, 404);
    const actorAccessError = assertActorCanAccessUser(actor, clean(submission.user_id || '', 120), { allowPrivileged: true });
    if (actorAccessError) return actorAccessError;

    const rubric = submission.rubric_id
      ? await c.env.DEEPLEARN_DB.prepare(
          `SELECT id, title, rubric_json, pass_threshold
           FROM assignment_rubrics
           WHERE id = ? LIMIT 1`
        )
          .bind(submission.rubric_id)
          .first()
      : null;

    const grading = await gradeAssignmentSubmission({
      env: c.env,
      groqKey,
      answerText: String(submission.answer_text || ''),
      rubricTitle: clean(rubric?.title || 'Assignment Rubric', 200),
      rubricJson: clean(rubric?.rubric_json || '{}', 12000),
      passThreshold: Number(rubric?.pass_threshold || 70)
    });

    const nowMs = Date.now();
    await c.env.DEEPLEARN_DB.prepare(
      `UPDATE assignment_submissions
       SET ai_feedback_json = ?, score = ?, passed = ?, graded_at_ms = ?, status = 'graded'
       WHERE id = ?`
    )
      .bind(JSON.stringify({ feedback: grading.feedback }), grading.score, grading.passed ? 1 : 0, nowMs, submissionId)
      .run();

    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO assessment_events (
         org_id, course_id, module_id, cohort_id, user_id, event_name, score, passed, metadata_json, created_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        '',
        clean(submission.course_id || '', 64),
        clean(submission.module_id || '', 64),
        '',
        clean(submission.user_id || '', 120),
        'assignment_graded',
        grading.score,
        grading.passed ? 1 : 0,
        JSON.stringify({ submission_id: submissionId }),
        nowMs
      )
      .run();

    return c.json({
      ok: true,
      result: {
        submission_id: submissionId,
        score: grading.score,
        passed: grading.passed,
        feedback: grading.feedback
      }
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to grade assignment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses/:courseId/enroll', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const payload = await c.req.json();
    const userId = clean(payload?.user_id, 120) || `learner_${crypto.randomUUID()}`;
    const email = clean(payload?.email, 220).toLowerCase();
    const displayName = clean(payload?.display_name, 140) || email || 'Learner';
    const status = clean(payload?.status, 32) || 'active';

    if (!courseId) return c.json({ error: 'courseId is required.' }, 400);
    if (!LEARNER_STATUSES.has(status)) return c.json({ error: 'Invalid learner status.' }, 400);

    await upsertPlatformUser(c.env.DEEPLEARN_DB, { userId, email, displayName, role: 'learner' });

    const nowMs = Date.now();
    await c.env.DEEPLEARN_DB.prepare(
      `INSERT INTO course_enrollments (
         course_id, user_id, status, progress_pct, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, 0, NULL, '', ?, ?)
       ON CONFLICT(course_id, user_id) DO UPDATE SET
         status = excluded.status,
         updated_at_ms = excluded.updated_at_ms`
    )
      .bind(courseId, userId, status, nowMs, nowMs)
      .run();

    return c.json({ ok: true, course_id: courseId, user_id: userId, status });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to enroll learner.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/courses/:courseId/enroll/:userId/complete', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    const userId = clean(c.req.param('userId'), 120);
    const payload = await c.req.json();
    const certificateUrl = clean(payload?.certificate_url, 400);
    const nowMs = Date.now();

    if (!courseId || !userId) {
      return c.json({ error: 'courseId and userId are required.' }, 400);
    }

    await c.env.DEEPLEARN_DB.prepare(
      `UPDATE course_enrollments
       SET status = 'completed',
           progress_pct = 100,
           completed_at_ms = ?,
           certificate_url = ?,
           updated_at_ms = ?
       WHERE course_id = ? AND user_id = ?`
    )
      .bind(nowMs, certificateUrl, nowMs, courseId, userId)
      .run();

    return c.json({ ok: true, course_id: courseId, user_id: userId, status: 'completed', certificate_url: certificateUrl });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to complete enrollment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/courses/:courseId/enrollments', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const courseId = clean(c.req.param('courseId'), 64);
    if (!courseId) return c.json({ error: 'courseId is required.' }, 400);

    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         e.course_id, e.user_id, e.status, e.progress_pct, e.completed_at_ms, e.certificate_url, e.updated_at_ms,
         u.email, u.display_name
       FROM course_enrollments e
       LEFT JOIN platform_users u ON u.uid = e.user_id
       WHERE e.course_id = ?
       ORDER BY e.updated_at_ms DESC`
    )
      .bind(courseId)
      .all();

    return c.json({ enrollments: result.results || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list enrollments.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/content/posts', async (c) => {
  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'Content database is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') || 6)));
    const result = await c.env.DEEPLEARN_DB.prepare(
      `SELECT
         id, slug, title, summary, path, tags_json, source_urls_json, published_at_ms, created_at_ms
       FROM content_posts
       WHERE status = 'published'
       ORDER BY COALESCE(published_at_ms, created_at_ms) DESC
       LIMIT ?`
    )
      .bind(limit)
      .all();

    const posts = (result.results || []).map((row) => {
      const tags = parseJsonArray(row.tags_json);
      const sourceUrls = parseJsonArray(row.source_urls_json);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        path: row.path,
        tags,
        source_urls: sourceUrls,
        link: sourceUrls[0] || 'https://greybrain.ai/clinical-ai',
        date: msToIsoDate(row.published_at_ms || row.created_at_ms)
      };
    });

    return c.json({ posts });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list published content.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.get('/api/admin/content/posts', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 20)));
    const requestedStatus = clean(c.req.query('status'), 32).toLowerCase();
    if (requestedStatus && requestedStatus !== 'all' && !CONTENT_STATUSES.has(requestedStatus)) {
      return c.json({ error: 'Invalid content status filter.' }, 400);
    }
    const whereClause = requestedStatus && requestedStatus !== 'all' ? 'WHERE status = ?' : '';
    const query = `SELECT
        id, slug, title, summary, status, path, tags_json, source_urls_json,
        model_name, prompt_version, generated_at_ms, approved_at_ms, published_at_ms, updated_at_ms
      FROM content_posts
      ${whereClause}
      ORDER BY updated_at_ms DESC
      LIMIT ?`;

    const statement = c.env.DEEPLEARN_DB.prepare(query);
    const result =
      whereClause ? await statement.bind(requestedStatus, limit).all() : await statement.bind(limit).all();

    const posts = (result.results || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      status: row.status,
      path: row.path,
      tags: parseJsonArray(row.tags_json),
      source_urls: parseJsonArray(row.source_urls_json),
      model_name: row.model_name,
      prompt_version: row.prompt_version,
      generated_at_ms: row.generated_at_ms,
      approved_at_ms: row.approved_at_ms,
      published_at_ms: row.published_at_ms,
      updated_at_ms: row.updated_at_ms
    }));

    return c.json({ posts });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to list admin content posts.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/content/generate-daily', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    let payload = {};
    try {
      payload = await c.req.json();
    } catch {
      payload = {};
    }
    const groqKey = clean(payload?.groq_key, 240);
    const force = payload?.force === true;

    const generated = await generateDailyContentDraft(c.env, {
      mode: 'manual',
      force,
      apiKeyOverride: groqKey || ''
    });

    return c.json({
      ok: true,
      generated
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to generate daily content.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

app.post('/api/admin/content/posts/:postId/status', async (c) => {
  const authError = await assertAdmin(c);
  if (authError) return authError;

  if (!c.env.DEEPLEARN_DB) {
    return c.json({ error: 'D1 is not configured.' }, 500);
  }

  try {
    await ensureOpsSchema(c.env.DEEPLEARN_DB);
    const postId = clean(c.req.param('postId'), 64);
    const payload = await c.req.json();
    const status = clean(payload?.status, 32).toLowerCase();

    if (!postId) return c.json({ error: 'postId is required.' }, 400);
    if (!CONTENT_STATUSES.has(status)) return c.json({ error: 'Invalid content status.' }, 400);

    const nowMs = Date.now();
    const result = await c.env.DEEPLEARN_DB.prepare(
      `UPDATE content_posts
       SET status = ?,
           approved_at_ms = CASE WHEN ? = 'approved' THEN ? ELSE approved_at_ms END,
           published_at_ms = CASE WHEN ? = 'published' THEN ? ELSE published_at_ms END,
           updated_at_ms = ?
       WHERE id = ?`
    )
      .bind(status, status, nowMs, status, nowMs, nowMs, postId)
      .run();

    if (!result.success || Number(result.meta?.changes || 0) === 0) {
      return c.json({ error: 'Content post not found.' }, 404);
    }

    await recordContentRun(c.env.DEEPLEARN_DB, {
      runType: 'status-update',
      status: 'success',
      message: `content status updated to ${status}`,
      postId
    });

    return c.json({ ok: true, post_id: postId, status });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to update content status.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

async function assertAdmin(c) {
  const configuredToken = (c.env.ADMIN_API_TOKEN || '').trim();
  if (!configuredToken) {
    return null;
  }

  const requestToken = (c.req.header('x-admin-token') || '').trim();
  if (!requestToken || requestToken !== configuredToken) {
    return c.json({ error: 'Unauthorized admin request.' }, 401);
  }

  return null;
}

async function ensureOpsSchema(db) {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS lead_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      webinar_id TEXT NOT NULL,
      source TEXT NOT NULL,
      country TEXT NOT NULL,
      is_likely_bot INTEGER NOT NULL DEFAULT 0,
      lead_id TEXT,
      session_id TEXT,
      path TEXT,
      email_hash TEXT,
      value REAL NOT NULL DEFAULT 1,
      bot_score REAL,
      asn INTEGER,
      created_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lead_events_webinar_created
      ON lead_events(webinar_id, created_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_lead_events_name_created
      ON lead_events(event_name, created_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_lead_events_bot_created
      ON lead_events(is_likely_bot, created_at_ms)`,
    `CREATE TABLE IF NOT EXISTS lead_registrations (
      lead_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      webinar_id TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      session_id TEXT NOT NULL DEFAULT '',
      course_id TEXT NOT NULL DEFAULT '',
      course_slug TEXT NOT NULL DEFAULT '',
      cohort_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'registered',
      payment_ref TEXT NOT NULL DEFAULT '',
      payment_provider TEXT NOT NULL DEFAULT '',
      paid_at_ms INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lead_registrations_email_updated
      ON lead_registrations(email, updated_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_lead_registrations_course_status
      ON lead_registrations(course_id, payment_status, updated_at_ms)`,
    `CREATE TABLE IF NOT EXISTS platform_users (
      uid TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      role TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_by TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_courses_status_updated
      ON courses(status, updated_at_ms)`,
    `CREATE TABLE IF NOT EXISTS course_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      UNIQUE(course_id, user_id, role)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_course_staff_course
      ON course_staff(course_id)`,
    `CREATE TABLE IF NOT EXISTS course_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress_pct REAL NOT NULL DEFAULT 0,
      completed_at_ms INTEGER,
      certificate_url TEXT,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      UNIQUE(course_id, user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_course_status
      ON course_enrollments(course_id, status)`,
    `CREATE TABLE IF NOT EXISTS content_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      path TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      source_urls_json TEXT NOT NULL,
      model_name TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      status TEXT NOT NULL,
      generated_at_ms INTEGER NOT NULL,
      approved_at_ms INTEGER,
      published_at_ms INTEGER,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_content_posts_status_updated
      ON content_posts(status, updated_at_ms)`,
    `CREATE TABLE IF NOT EXISTS content_generation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      post_id TEXT,
      created_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_content_generation_runs_created
      ON content_generation_runs(created_at_ms)`,
    `CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand_primary_color TEXT NOT NULL DEFAULT '#0f172a',
      logo_url TEXT NOT NULL DEFAULT '',
      settings_json TEXT NOT NULL DEFAULT '{}',
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_organizations_slug
      ON organizations(slug)`,
    `CREATE TABLE IF NOT EXISTS organization_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      UNIQUE(org_id, user_id, role)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_org_staff_org
      ON organization_staff(org_id)`,
    `CREATE TABLE IF NOT EXISTS course_modules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      path_key TEXT NOT NULL,
      module_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      content_markdown TEXT NOT NULL DEFAULT '',
      lab_type TEXT NOT NULL DEFAULT '',
      unlock_policy TEXT NOT NULL DEFAULT 'cohort',
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      is_published INTEGER NOT NULL DEFAULT 0,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      UNIQUE(course_id, module_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_course_modules_course_sort
      ON course_modules(course_id, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_course_modules_path
      ON course_modules(path_key, is_published)`,
    `CREATE TABLE IF NOT EXISTS cohorts (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT '',
      course_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'instructor-led',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      instructor_user_id TEXT NOT NULL DEFAULT '',
      fee_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cohorts_course_status
      ON cohorts(course_id, status, updated_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_cohorts_org_status
      ON cohorts(org_id, status, updated_at_ms)`,
    `CREATE TABLE IF NOT EXISTS cohort_module_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cohort_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      UNIQUE(cohort_id, module_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cohort_unlocks_cohort
      ON cohort_module_unlocks(cohort_id)`,
    `CREATE TABLE IF NOT EXISTS cohort_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cohort_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enrolled',
      progress_pct REAL NOT NULL DEFAULT 0,
      completion_state TEXT NOT NULL DEFAULT 'in_progress',
      completed_at_ms INTEGER,
      certificate_url TEXT NOT NULL DEFAULT '',
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      UNIQUE(cohort_id, user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cohort_enrollments_cohort_status
      ON cohort_enrollments(cohort_id, status, updated_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_cohort_enrollments_course_user
      ON cohort_enrollments(course_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS module_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cohort_id TEXT NOT NULL DEFAULT '',
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      score REAL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      artifact_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      updated_at_ms INTEGER NOT NULL,
      UNIQUE(course_id, module_id, user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_module_progress_user
      ON module_progress(user_id, updated_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_module_progress_course
      ON module_progress(course_id, module_id, status)`,
    `CREATE TABLE IF NOT EXISTS assignment_rubrics (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      title TEXT NOT NULL,
      rubric_json TEXT NOT NULL,
      pass_threshold REAL NOT NULL DEFAULT 70,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_course_module
      ON assignment_rubrics(course_id, module_id)`,
    `CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rubric_id TEXT NOT NULL DEFAULT '',
      answer_text TEXT NOT NULL DEFAULT '',
      artifacts_json TEXT NOT NULL DEFAULT '[]',
      ai_feedback_json TEXT NOT NULL DEFAULT '{}',
      score REAL,
      passed INTEGER NOT NULL DEFAULT 0,
      submitted_at_ms INTEGER NOT NULL,
      graded_at_ms INTEGER,
      grader_mode TEXT NOT NULL DEFAULT 'ai',
      status TEXT NOT NULL DEFAULT 'submitted'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user
      ON assignment_submissions(user_id, submitted_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_assignment_submissions_course_module
      ON assignment_submissions(course_id, module_id, status)`,
    `CREATE TABLE IF NOT EXISTS lab_runs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT '',
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      path_key TEXT NOT NULL,
      tool_type TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      model_name TEXT NOT NULL DEFAULT '',
      input_hash TEXT NOT NULL DEFAULT '',
      output_json TEXT NOT NULL DEFAULT '{}',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      cost_microunits INTEGER NOT NULL DEFAULT 0,
      created_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lab_runs_user_created
      ON lab_runs(user_id, created_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_lab_runs_path_created
      ON lab_runs(path_key, created_at_ms)`,
    `CREATE TABLE IF NOT EXISTS capstone_artifacts (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      cohort_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      path_key TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      artifact_url TEXT NOT NULL DEFAULT '',
      pitch_deck_url TEXT NOT NULL DEFAULT '',
      data_room_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted',
      score REAL,
      feedback_json TEXT NOT NULL DEFAULT '{}',
      submitted_at_ms INTEGER NOT NULL,
      reviewed_at_ms INTEGER,
      reviewer_id TEXT NOT NULL DEFAULT '',
      updated_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_capstone_artifacts_user_updated
      ON capstone_artifacts(user_id, updated_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_capstone_artifacts_course_status
      ON capstone_artifacts(course_id, status, updated_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_capstone_artifacts_path_status
      ON capstone_artifacts(path_key, status, updated_at_ms)`,
    `CREATE TABLE IF NOT EXISTS learning_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL DEFAULT '',
      course_id TEXT NOT NULL DEFAULT '',
      module_id TEXT NOT NULL DEFAULT '',
      cohort_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      event_name TEXT NOT NULL,
      event_value REAL NOT NULL DEFAULT 1,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_learning_events_course_created
      ON learning_events(course_id, event_name, created_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_learning_events_user_created
      ON learning_events(user_id, created_at_ms)`,
    `CREATE TABLE IF NOT EXISTS assessment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL DEFAULT '',
      course_id TEXT NOT NULL DEFAULT '',
      module_id TEXT NOT NULL DEFAULT '',
      cohort_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      event_name TEXT NOT NULL,
      score REAL,
      passed INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_events_course_created
      ON assessment_events(course_id, module_id, created_at_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_events_user_created
      ON assessment_events(user_id, created_at_ms)`
  ];

  for (const statement of ddl) {
    await db.prepare(statement).run();
  }
}

async function upsertPlatformUser(db, { userId, email, displayName, role }) {
  const nowMs = Date.now();
  await db.prepare(
    `INSERT INTO platform_users (uid, email, display_name, role, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       role = excluded.role,
       updated_at_ms = excluded.updated_at_ms`
  )
    .bind(userId, email || '', displayName || '', role || 'learner', nowMs, nowMs)
    .run();
}

async function resolveLearningTargetByCourse(db, { courseId, courseSlug, cohortId }) {
  let resolvedCourseId = clean(courseId, 64);
  let resolvedCourseSlug = slugify(clean(courseSlug, 120));
  let resolvedCourseTitle = '';
  let resolvedCohortId = clean(cohortId, 64);

  if (!resolvedCourseId && resolvedCourseSlug) {
    const row = await db.prepare('SELECT id, slug, title FROM courses WHERE slug = ? LIMIT 1').bind(resolvedCourseSlug).first();
    resolvedCourseId = clean(row?.id || '', 64);
    resolvedCourseSlug = clean(row?.slug || resolvedCourseSlug, 120);
    resolvedCourseTitle = clean(row?.title || '', 180);
  }

  if (resolvedCourseId) {
    const row = await db.prepare('SELECT id, slug, title FROM courses WHERE id = ? LIMIT 1').bind(resolvedCourseId).first();
    if (row) {
      resolvedCourseSlug = clean(row.slug || resolvedCourseSlug, 120);
      resolvedCourseTitle = clean(row.title || '', 180);
    }
  }

  if (resolvedCohortId) {
    const row = await db.prepare('SELECT id, course_id FROM cohorts WHERE id = ? LIMIT 1').bind(resolvedCohortId).first();
    const cohortCourseId = clean(row?.course_id || '', 64);
    if (!row || (resolvedCourseId && cohortCourseId !== resolvedCourseId)) {
      resolvedCohortId = '';
    } else if (!resolvedCourseId && cohortCourseId) {
      resolvedCourseId = cohortCourseId;
      const courseRow = await db.prepare('SELECT slug, title FROM courses WHERE id = ? LIMIT 1').bind(resolvedCourseId).first();
      resolvedCourseSlug = clean(courseRow?.slug || resolvedCourseSlug, 120);
      resolvedCourseTitle = clean(courseRow?.title || '', 180);
    }
  }

  if (!resolvedCohortId && resolvedCourseId) {
    const preferred = await db.prepare(
      `SELECT id
       FROM cohorts
       WHERE course_id = ?
       ORDER BY
         CASE status WHEN 'live' THEN 0 WHEN 'open' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
         updated_at_ms DESC
       LIMIT 1`
    )
      .bind(resolvedCourseId)
      .first();
    resolvedCohortId = clean(preferred?.id || '', 64);
  }

  return {
    courseId: resolvedCourseId,
    courseSlug: resolvedCourseSlug,
    courseTitle: resolvedCourseTitle,
    cohortId: resolvedCohortId
  };
}

async function upsertCourseEnrollment(db, { courseId, userId, status, progressPct, certificateUrl, nowMs }) {
  await db.prepare(
    `INSERT INTO course_enrollments (
       course_id, user_id, status, progress_pct, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
     ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(course_id, user_id) DO UPDATE SET
       status = excluded.status,
       progress_pct = excluded.progress_pct,
       certificate_url = excluded.certificate_url,
       updated_at_ms = excluded.updated_at_ms`
  )
    .bind(courseId, userId, status || 'active', Number(progressPct || 0), certificateUrl || '', nowMs, nowMs)
    .run();
}

async function upsertCohortEnrollment(db, { cohortId, courseId, userId, status, nowMs }) {
  await db.prepare(
    `INSERT INTO cohort_enrollments (
       cohort_id, course_id, user_id, status, progress_pct, completion_state, completed_at_ms, certificate_url, created_at_ms, updated_at_ms
     ) VALUES (?, ?, ?, ?, 0, 'in_progress', NULL, '', ?, ?)
     ON CONFLICT(cohort_id, user_id) DO UPDATE SET
       status = excluded.status,
       updated_at_ms = excluded.updated_at_ms`
  )
    .bind(cohortId, courseId, userId, status || 'enrolled', nowMs, nowMs)
    .run();
}

async function ensureCohortBootstrapUnlock(db, cohortId, courseId, nowMs) {
  if (!cohortId || !courseId) return;
  const unlockCountRow = await db.prepare('SELECT COUNT(*) AS count FROM cohort_module_unlocks WHERE cohort_id = ?').bind(cohortId).first();
  const unlockCount = Number(unlockCountRow?.count || 0);
  if (unlockCount > 0) return;

  const firstModule = await db.prepare(
    `SELECT id
     FROM course_modules
     WHERE course_id = ?
     ORDER BY is_published DESC, sort_order ASC, updated_at_ms DESC
     LIMIT 1`
  )
    .bind(courseId)
    .first();
  const moduleId = clean(firstModule?.id || '', 64);
  if (!moduleId) return;

  await db.prepare(
    `INSERT OR IGNORE INTO cohort_module_unlocks (cohort_id, module_id, created_at_ms)
     VALUES (?, ?, ?)`
  )
    .bind(cohortId, moduleId, nowMs)
    .run();
}

async function scalarCount(db, query) {
  const row = await db.prepare(query).first();
  return Number(row?.count || 0);
}

function normalizeRole(role) {
  const value = clean(role, 40).toLowerCase();
  if (!value) return '';
  if (value === 'admin') return 'coordinator';
  if (value === 'trainer') return 'teacher';
  if (value === 'student') return 'learner';
  return value;
}

function parseRoleHeader(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .split(',')
    .map((entry) => normalizeRole(entry))
    .filter(Boolean);
}

function hasAnyRole(roles, allowedRoles) {
  const roleSet = new Set((roles || []).map((role) => normalizeRole(role)).filter(Boolean));
  return (allowedRoles || []).some((role) => roleSet.has(normalizeRole(role)));
}

async function resolveActorContext(c, { requireUser = false } = {}) {
  const configuredAdminToken = clean(c.env.ADMIN_API_TOKEN || '', 200);
  const requestAdminToken = clean(c.req.header('x-admin-token') || '', 200);
  const isAdmin = Boolean(configuredAdminToken && requestAdminToken && requestAdminToken === configuredAdminToken);
  const userId = clean(c.req.header('x-user-id') || c.req.header('x-actor-id') || c.req.header('x-firebase-uid') || '', 120);
  const roles = new Set([
    ...parseRoleHeader(c.req.header('x-user-roles')),
    ...parseRoleHeader(c.req.header('x-user-role')),
    ...parseRoleHeader(c.req.header('x-actor-roles'))
  ]);

  if (isAdmin) {
    roles.add('coordinator');
    roles.add('cto');
  }

  if (c.env.DEEPLEARN_DB && userId) {
    const platformRole = await c.env.DEEPLEARN_DB.prepare('SELECT role FROM platform_users WHERE uid = ? LIMIT 1')
      .bind(userId)
      .first();
    if (platformRole?.role) roles.add(normalizeRole(platformRole.role));

    const courseRoles = await c.env.DEEPLEARN_DB.prepare('SELECT role FROM course_staff WHERE user_id = ?').bind(userId).all();
    for (const row of courseRoles.results || []) {
      if (row?.role) roles.add(normalizeRole(row.role));
    }

    const orgRoles = await c.env.DEEPLEARN_DB.prepare('SELECT role FROM organization_staff WHERE user_id = ?').bind(userId).all();
    for (const row of orgRoles.results || []) {
      if (row?.role) roles.add(normalizeRole(row.role));
    }
  }

  if (userId && roles.size === 0) {
    roles.add('learner');
  }

  if (requireUser && !isAdmin && !userId) {
    return {
      userId: '',
      roles: [],
      isAdmin,
      error: c.json({ error: 'Missing actor identity. Pass x-user-id header or valid admin token.' }, 401)
    };
  }

  return {
    userId,
    roles: Array.from(roles),
    isAdmin,
    error: null
  };
}

function assertActorCanAccessUser(actor, targetUserId, { allowPrivileged = false } = {}) {
  const userId = clean(targetUserId, 120);
  if (!userId) {
    return actor.error ?? new Response(JSON.stringify({ error: 'user_id is required.' }), { status: 400 });
  }

  if (actor.isAdmin) return null;
  if (actor.userId && actor.userId === userId) return null;
  if (allowPrivileged && hasAnyRole(actor.roles, ['teacher', 'coordinator', 'cto'])) return null;

  return new Response(JSON.stringify({ error: 'Access denied for requested user.' }), {
    status: 403,
    headers: { 'content-type': 'application/json' }
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function resolveGroqBaseUrl(env) {
  const gatewayBaseUrl = (env.AI_GATEWAY_BASE_URL || '').trim();
  if (gatewayBaseUrl) {
    return gatewayBaseUrl.replace(/\/+$/, '');
  }

  return resolveDirectGroqBaseUrl(env);
}

function resolveDirectGroqBaseUrl(env) {
  const groqBaseUrl = (env.GROQ_API_BASE_URL || '').trim();
  if (groqBaseUrl) {
    return groqBaseUrl.replace(/\/+$/, '');
  }

  return 'https://api.groq.com/openai/v1';
}

function resolveGroqModel(env, baseUrl) {
  const configuredModel = (env.GROQ_MODEL || '').trim() || 'llama-3.3-70b-versatile';
  if (baseUrl.includes('/compat') && !configuredModel.includes('/')) {
    return `groq/${configuredModel}`;
  }

  return configuredModel;
}

function shouldFallbackToDirectGroq(baseUrl, details) {
  if (!baseUrl.includes('gateway.ai.cloudflare.com')) {
    return false;
  }

  const text = String(details || '');
  return /please configure ai gateway|\"code\"\s*:\s*2001|ai gateway/i.test(text);
}

async function queryCourseContext(env, message, moduleId) {
  const embedding = await embedQuery(env, message);

  const result = await env.DEEPLEARN_INDEX.query(embedding, {
    topK: 6,
    returnMetadata: 'all',
    filter: {
      type: 'content',
      ...(moduleId ? { module_id: moduleId } : {})
    }
  });

  const chunks = (result?.matches ?? [])
    .map((match) => match.metadata?.chunk_text)
    .filter(Boolean)
    .slice(0, 6);

  if (chunks.length === 0) {
    return 'No relevant syllabus chunks found.';
  }

  return chunks.join('\n\n');
}

async function embedQuery(env, text) {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text]
  });

  const vector = response?.data?.[0];

  if (!Array.isArray(vector)) {
    throw new Error('Embedding generation failed.');
  }

  return vector;
}

async function writeGrowthEvent(env, cf, event) {
  const country = clean(cf?.country, 8) || 'XX';
  const botScore = Number.isFinite(Number(cf?.botManagement?.score)) ? Number(cf.botManagement.score) : -1;
  const asn = Number.isFinite(Number(cf?.asn)) ? Number(cf.asn) : 0;
  const isLikelyBot = botScore >= 0 && botScore < 30 ? 1 : 0;
  const nowMs = Date.now();

  if (env.DEEPLEARN_DB) {
    const insertStmt = env.DEEPLEARN_DB.prepare(
      `INSERT INTO lead_events (
        event_name, webinar_id, source, country, is_likely_bot, lead_id, session_id,
        path, email_hash, value, bot_score, asn, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.eventName,
      event.webinarId,
      event.source || 'landing',
      country,
      isLikelyBot,
      event.leadId || '',
      event.sessionId || '',
      event.path || '',
      event.emailHash || '',
      event.value ?? 1,
      botScore,
      asn,
      nowMs
    );

    try {
      await insertStmt.run();
    } catch {
      // Fresh environments may not have schema applied yet.
      await ensureOpsSchema(env.DEEPLEARN_DB);
      await insertStmt.run();
    }
  }

  if (env.LEAD_ANALYTICS?.writeDataPoint) {
    env.LEAD_ANALYTICS.writeDataPoint({
      indexes: [event.eventName, event.webinarId, event.source, country, String(isLikelyBot)],
      blobs: [event.leadId || '', event.sessionId || '', event.path || '', event.emailHash || ''],
      doubles: [nowMs, event.value ?? 1, botScore, asn]
    });
  }
}

async function verifyTurnstile({ secret, token, remoteIp }) {
  if (!secret) {
    return { success: false, errorCodes: ['missing-secret-config'] };
  }

  const body = new URLSearchParams({
    secret,
    response: token
  });

  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    return { success: false, errorCodes: ['turnstile-request-failed'] };
  }

  const result = await response.json();

  return {
    success: Boolean(result?.success),
    errorCodes: result?.['error-codes'] || []
  };
}

async function gradeAssignmentSubmission({ env, groqKey, answerText, rubricTitle, rubricJson, passThreshold }) {
  const fallbackScore = answerText.trim().length >= 500 ? 78 : answerText.trim().length >= 250 ? 66 : 44;
  const fallbackResult = {
    score: fallbackScore,
    passed: fallbackScore >= passThreshold,
    feedback:
      fallbackScore >= passThreshold
        ? 'Submission covers key points and passes baseline rubric expectations.'
        : 'Submission is too brief or incomplete. Expand key concepts, methods, and evidence references.'
  };

  const apiKey = (groqKey || env.GROQ_API_KEY || '').trim();
  if (!apiKey) return fallbackResult;

  const requestPayload = {
    model: resolveGroqModel(env, resolveGroqBaseUrl(env)),
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are a strict evaluator. Respond in valid JSON only: {"score": number, "feedback": string, "passed": boolean}.'
      },
      {
        role: 'user',
        content: `Rubric title: ${rubricTitle}\nPass threshold: ${passThreshold}\nRubric JSON: ${rubricJson}\n\nStudent answer:\n${answerText}\n\nReturn score 0-100 and concise feedback.`
      }
    ]
  };

  let baseUrl = resolveGroqBaseUrl(env);
  let model = resolveGroqModel(env, baseUrl);

  const runModelCall = async (targetBaseUrl, targetModel, includeResponseFormat) => {
    const body = {
      ...requestPayload,
      model: targetModel
    };
    if (includeResponseFormat) {
      body.response_format = { type: 'json_object' };
    }
    return fetch(`${targetBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  };

  let response = await runModelCall(baseUrl, model, true);
  if (!response.ok) {
    let details = await response.text();
    const fallbackToDirect = shouldFallbackToDirectGroq(baseUrl, details);
    if (fallbackToDirect) {
      baseUrl = resolveDirectGroqBaseUrl(env);
      model = resolveGroqModel(env, baseUrl);
      response = await runModelCall(baseUrl, model, false);
    } else if (/response_format|unsupported|unknown/i.test(details)) {
      response = await runModelCall(baseUrl, model, false);
    }

    if (!response.ok) {
      details = await response.text();
      return {
        ...fallbackResult,
        feedback: `${fallbackResult.feedback} (Auto-grade fallback used: ${clean(details, 180)})`
      };
    }
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    return fallbackResult;
  }

  try {
    const parsed = parseJsonObject(content);
    const scoreRaw = Number(parsed?.score);
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, scoreRaw)) : fallbackResult.score;
    const feedback = clean(String(parsed?.feedback || ''), 1200) || fallbackResult.feedback;
    const passed = typeof parsed?.passed === 'boolean' ? parsed.passed : score >= passThreshold;
    return { score, feedback, passed };
  } catch {
    return fallbackResult;
  }
}

function summarizeLabInput(input) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= 220 ? text : `${text.slice(0, 217)}...`;
}

function generateLabRunOutput({ pathKey, toolType, modelName, input }) {
  const inputSummary = summarizeLabInput(input);
  const tokenEstimate = Math.max(8, Math.round(String(input || '').length / 4));
  const shared = {
    tool_type: clean(toolType || 'experiment', 80) || 'experiment',
    model_name: clean(modelName || 'byok-model', 120) || 'byok-model',
    input_summary: inputSummary,
    token_estimate: tokenEstimate
  };

  if (pathKey === 'productivity') {
    return {
      ...shared,
      output_type: 'workflow-optimization',
      suggestions: [
        'Convert repeated note templates into reusable prompt snippets.',
        'Attach checklist-based guardrails before sharing patient-facing drafts.',
        'Track response latency and quality weekly to retire low-performing prompts.'
      ],
      estimated_time_saved_minutes_per_case: 12
    };
  }

  if (pathKey === 'research') {
    return {
      ...shared,
      output_type: 'research-augmentation',
      hypothesis_candidates: [
        'Identify cohort stratification variables with highest effect on outcome variance.',
        'Map exclusion criteria conflicts across protocol drafts before IRB submission.',
        'Generate reproducible methods summary aligned to reporting standards.'
      ],
      confidence_note: 'Use as triage output; validate against source methods and statistics.'
    };
  }

  return {
    ...shared,
    output_type: 'venture-planning',
    venture_canvas: {
      problem_statement: 'Clinical workflow bottleneck validated by frontline users.',
      target_user: 'Specialist clinician and care coordinator team',
      pilot_metric: 'Reduction in turnaround time and improved adherence rate',
      next_milestone: 'Produce capstone artifact with pilot scope, risk controls, and ROI assumptions.'
    }
  };
}

async function runScheduledContentGeneration(env, cron) {
  if (!env.DEEPLEARN_DB) {
    return;
  }

  try {
    await ensureOpsSchema(env.DEEPLEARN_DB);
    await generateDailyContentDraft(env, { mode: `scheduled:${cron || 'daily'}`, force: false, apiKeyOverride: '' });
  } catch (error) {
    await recordContentRun(env.DEEPLEARN_DB, {
      runType: 'scheduled',
      status: 'error',
      message: error instanceof Error ? error.message : 'scheduled content generation failed',
      postId: ''
    });
  }
}

async function generateDailyContentDraft(env, { mode, force, apiKeyOverride }) {
  const db = env.DEEPLEARN_DB;
  if (!db) {
    throw new Error('D1 is not configured.');
  }

  const nowMs = Date.now();
  const publishDate = isoDateInTimezone(nowMs, 'Asia/Kolkata');
  const dateSlug = publishDate.replace(/-/g, '');
  const existing = await db.prepare('SELECT id, status FROM content_posts WHERE slug = ?').bind(`daily-${dateSlug}`).first();

  if (existing && !force) {
    const message = `Draft already exists for ${publishDate}`;
    await recordContentRun(db, {
      runType: mode,
      status: 'skipped',
      message,
      postId: existing.id
    });

    return {
      skipped: true,
      reason: message,
      post_id: existing.id,
      status: existing.status
    };
  }

  const sourceSnapshot = await fetchClinicalFeedSnapshot();
  const apiKey = (apiKeyOverride || env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing Groq API key. Provide groq_key or set GROQ_API_KEY in worker secrets.');
  }

  const baseUrl = resolveGroqBaseUrl(env);
  const model = resolveGroqModel(env, baseUrl);
  const prompt = buildDailyPrompt({ publishDate, sourceSnapshot });
  const generationResult = await callGroqForDailyContent({
    env,
    apiKey,
    baseUrl,
    model,
    prompt
  });
  const normalized = validateGeneratedContent(generationResult.payload, sourceSnapshot);

  const postId = existing?.id || crypto.randomUUID();
  const slug = `daily-${dateSlug}`;
  const sourceUrls = normalized.sources.map((source) => source.url);
  const tags = normalized.tags.length > 0 ? normalized.tags : ['clinical-ai', 'greybrain-daily'];

  const upsertResult = await db.prepare(
    `INSERT INTO content_posts (
      id, slug, title, summary, content_markdown, path, tags_json, source_urls_json, model_name,
      prompt_version, status, generated_at_ms, approved_at_ms, published_at_ms, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      summary = excluded.summary,
      content_markdown = excluded.content_markdown,
      path = excluded.path,
      tags_json = excluded.tags_json,
      source_urls_json = excluded.source_urls_json,
      model_name = excluded.model_name,
      prompt_version = excluded.prompt_version,
      status = 'draft',
      generated_at_ms = excluded.generated_at_ms,
      approved_at_ms = NULL,
      published_at_ms = NULL,
      updated_at_ms = excluded.updated_at_ms`
  )
    .bind(
      postId,
      slug,
      normalized.title,
      normalized.summary,
      normalized.content_markdown,
      normalized.path,
      JSON.stringify(tags),
      JSON.stringify(sourceUrls),
      generationResult.model,
      DAILY_PROMPT_VERSION,
      nowMs,
      nowMs,
      nowMs
    )
    .run();

  if (!upsertResult.success) {
    throw new Error('Failed to save generated content.');
  }

  await recordContentRun(db, {
    runType: mode,
    status: 'success',
    message: `Draft generated for ${publishDate}`,
    postId
  });

  return {
    skipped: false,
    post_id: postId,
    slug,
    title: normalized.title,
    summary: normalized.summary,
    path: normalized.path,
    model: generationResult.model,
    sources: normalized.sources
  };
}

async function recordContentRun(db, { runType, status, message, postId }) {
  await db.prepare(
    `INSERT INTO content_generation_runs (run_type, status, message, post_id, created_at_ms)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(runType || 'manual', status || 'unknown', message || '', postId || '', Date.now())
    .run();
}

function buildDailyPrompt({ publishDate, sourceSnapshot }) {
  return `You are writing the "Greybrain.AI Daily — Stay Ahead in Medicine" briefing.
Date: ${publishDate}

Output STRICT JSON only (no markdown fences) with keys:
{
  "title": string,
  "summary": string,
  "path": "productivity" | "research" | "entrepreneurship",
  "content_markdown": string,
  "tags": string[],
  "sources": [{"title": string, "url": string, "date": string}]
}

Hard rules:
1) Keep an editorial clinician-to-clinician tone. No hype language.
2) Do not invent facts or dates. Use only the supplied source items.
3) Mention uncertainty if evidence is weak.
4) Keep summary under 220 characters.
5) In content_markdown include three cards with headings:
   - Card 1: Model Spotlight
   - Card 2: Clinical AI in Practice
   - Card 3: Do-AI-Yourself (Prompt Artifact)
6) Card 3 must include this exact prompt block:
"I am a physician.
Based on the attached clinical study, act as a medical communications expert and create:
1) A three-point plain-language summary for a patient’s family
2) Two ‘Did You Know?’ insights derived directly from the study data
3) A five-step outline suitable for a patient-facing infographic"
7) Include a final section "Sources" with markdown links only from the provided list.

Provided source items:
${sourceSnapshot.map((item, idx) => `${idx + 1}. ${item.title} | ${item.url} | ${item.date}`).join('\n')}
`;
}

async function callGroqForDailyContent({ env, apiKey, baseUrl, model, prompt }) {
  let activeBaseUrl = baseUrl;
  let activeModel = model;

  const requestBase = {
    model: activeModel,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You are a clinically cautious editorial assistant. Return valid JSON only.'
      },
      { role: 'user', content: prompt }
    ]
  };

  const firstAttempt = await fetch(`${activeBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...requestBase,
      response_format: { type: 'json_object' }
    })
  });

  let payload;
  if (firstAttempt.ok) {
    payload = await firstAttempt.json();
  } else {
    const details = await firstAttempt.text();
    const fallbackToDirect = shouldFallbackToDirectGroq(activeBaseUrl, details);
    if (fallbackToDirect) {
      activeBaseUrl = resolveDirectGroqBaseUrl(env);
      activeModel = resolveGroqModel(env, activeBaseUrl);
    }

    const shouldRetryWithoutResponseFormat = /response_format|unsupported|unknown/i.test(details) || fallbackToDirect;
    if (!shouldRetryWithoutResponseFormat) {
      throw new Error(`Groq content generation failed: ${details || firstAttempt.status}`);
    }

    const retryAttempt = await fetch(`${activeBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...requestBase, model: activeModel })
    });

    if (!retryAttempt.ok) {
      const retryDetails = await retryAttempt.text();
      throw new Error(`Groq content generation failed: ${retryDetails || retryAttempt.status}`);
    }

    payload = await retryAttempt.json();
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Model returned empty content payload.');
  }

  let parsedPayload;
  try {
    parsedPayload = parseJsonObject(content);
  } catch {
    const repaired = await repairJsonWithModel({
      apiKey,
      baseUrl: activeBaseUrl,
      model: activeModel,
      malformedText: content
    });
    parsedPayload = parseJsonObject(repaired);
  }

  return {
    payload: parsedPayload,
    model: activeModel
  };
}

async function repairJsonWithModel({ apiKey, baseUrl, model, malformedText }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You repair malformed JSON. Return valid JSON only with no markdown code fences.'
        },
        {
          role: 'user',
          content: `Fix this into valid JSON. Preserve all keys/values and do not summarize:\n${malformedText}`
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to repair malformed JSON output: ${details || response.status}`);
  }

  const payload = await response.json();
  const repaired = payload?.choices?.[0]?.message?.content;
  if (!repaired || typeof repaired !== 'string') {
    throw new Error('Model did not return repaired JSON content.');
  }

  return repaired;
}

function parseJsonObject(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Model response is not valid JSON.');
  }
}

function validateGeneratedContent(payload, sourceSnapshot) {
  const sourceMap = new Map(sourceSnapshot.map((item) => [item.url, item]));
  const title = clean(String(payload?.title || ''), 200);
  const summary = clean(String(payload?.summary || ''), 240);
  const path = clean(String(payload?.path || ''), 40).toLowerCase();
  const contentMarkdown = String(payload?.content_markdown || '').trim();
  const tags = Array.isArray(payload?.tags)
    ? payload.tags.map((tag) => clean(String(tag), 32).toLowerCase()).filter(Boolean).slice(0, 8)
    : [];
  const rawSources = Array.isArray(payload?.sources) ? payload.sources : [];
  const sources = rawSources
    .map((source) => ({
      title: clean(String(source?.title || ''), 200),
      url: clean(String(source?.url || ''), 400),
      date: clean(String(source?.date || ''), 40)
    }))
    .filter((source) => source.url && source.title && sourceMap.has(source.url))
    .slice(0, 8);

  if (!title || !summary || !contentMarkdown) {
    throw new Error('Generated content is missing title, summary, or body.');
  }

  if (!['productivity', 'research', 'entrepreneurship'].includes(path)) {
    throw new Error('Generated content path must be productivity, research, or entrepreneurship.');
  }

  if (!contentMarkdown.includes('Card 1:') || !contentMarkdown.includes('Card 2:') || !contentMarkdown.includes('Card 3:')) {
    throw new Error('Generated content is missing required card structure.');
  }

  if (!contentMarkdown.includes('I am a physician.')) {
    throw new Error('Generated content is missing mandatory DIY prompt artifact.');
  }

  if (sources.length < 2) {
    throw new Error('Generated content requires at least 2 verified sources.');
  }

  return {
    title,
    summary,
    path,
    content_markdown: contentMarkdown.slice(0, 48000),
    tags,
    sources
  };
}

async function fetchClinicalFeedSnapshot() {
  const sourceCandidates = [
    { title: 'Greybrain Clinical AI Feed', url: 'https://medium.com/feed/@ClinicalAI' },
    { title: 'Greybrain Clinical AI', url: 'https://greybrain.ai/clinical-ai' }
  ];

  const snapshots = [];

  for (const source of sourceCandidates) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; DeepLearnContentBot/1.0)'
        }
      });
      if (!response.ok) continue;
      const text = await response.text();
      const items = source.url.includes('/feed/')
        ? parseRssItems(text)
        : [{ title: source.title, url: source.url, date: isoDateInTimezone(Date.now(), 'UTC') }];
      snapshots.push(...items);
    } catch {
      // Ignore source fetch failures and continue.
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const item of snapshots) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }

  if (deduped.length === 0) {
    throw new Error('Unable to load source feed for daily content generation.');
  }

  return deduped.slice(0, 8);
}

function parseRssItems(xml) {
  const matches = [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return matches
    .map((match) => {
      const item = match[1] || '';
      const title = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
      const url = decodeXml((item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '');
      const pubDateRaw = decodeXml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '');
      const parsedDate = new Date(pubDateRaw);
      const date = Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString().slice(0, 10);
      return {
        title: clean(title, 200),
        url: clean(url, 400),
        date
      };
    })
    .filter((item) => item.title && item.url);
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonArray(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean);
  } catch {
    return [];
  }
}

function parseJsonObjectOrDefault(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function isoDateInTimezone(ms, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(ms));
}

function msToIsoDate(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function buildCertificateUrl(env, { courseId, userId, issuedAtMs }) {
  const customBase = clean(env.CERTIFICATE_PUBLIC_BASE_URL || '', 400);
  if (customBase) {
    return `${customBase.replace(/\/+$/, '')}/${courseId}/${userId}.pdf`;
  }

  const bucket = clean(env.CERTIFICATE_BUCKET || 'gbdeeplearn-certificates', 120);
  const datePart = msToIsoDate(issuedAtMs || Date.now()) || 'today';
  return `https://${bucket}.r2.dev/certificates/${courseId}/${userId}-${datePart}.pdf`;
}

function clean(value, maxLen) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLen);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledContentGeneration(env, controller.cron));
  }
};
