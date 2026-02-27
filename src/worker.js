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

app.get('/', (c) => {
  return c.json({
    service: 'deeplearn-worker',
    status: 'ok',
    endpoints: [
      '/api/chat/tutor',
      '/api/track',
      '/api/lead/submit',
      '/api/analytics/funnel',
      '/api/admin/overview',
      '/api/admin/courses',
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

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `${TUTOR_PROMPT}\n\nCourse Context:\n${context}`
          },
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return c.json({ error: 'Groq request failed.', details }, 502);
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

    const lead = {
      lead_id: leadId,
      created_at: createdAt,
      full_name: fullName,
      email,
      phone,
      webinar_id: webinarId,
      source,
      session_id: sessionId,
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

    return c.json({ ok: true, lead_id: leadId });
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
      ON course_enrollments(course_id, status)`
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

async function scalarCount(db, query) {
  const row = await db.prepare(query).first();
  return Number(row?.count || 0);
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

export default app;
