#!/usr/bin/env node

const API_BASE_URL = (process.env.DEEPLEARN_API_BASE_URL || 'https://deeplearn-worker.satish-9f4.workers.dev').replace(/\/+$/, '');
const ADMIN_TOKEN = (process.env.ADMIN_API_TOKEN || process.env.DEEPLEARN_ADMIN_TOKEN || '').trim();

const seedSpec = {
  organizations: [
    {
      slug: 'greybrain-academy',
      name: 'GreyBrain Academy',
      brand_primary_color: '#0f172a',
      logo_url: 'https://greybrain.ai/favicon.ico'
    },
    {
      slug: 'clinical-ai-lab',
      name: 'Clinical AI Lab Network',
      brand_primary_color: '#0b3b5e',
      logo_url: ''
    }
  ],
  courses: [
    {
      slug: 'ai-productivity-clinical-practice',
      title: 'AI Productivity in Clinical Practice',
      status: 'live',
      price_cents: 24900,
      start_date: '2026-03-15',
      end_date: '2026-05-10',
      created_by: 'coordinator',
      path_key: 'productivity',
      teacher: {
        user_id: 'teacher_path1',
        email: 'trainer.path1@greybrain.ai',
        display_name: 'Dr Path 1 Trainer'
      },
      modules: [
        {
          module_key: 'ai-basics-for-clinicians',
          title: 'AI Basics for Clinicians',
          description: 'Lower the barrier to AI with practical clinical examples and risk boundaries.',
          lab_type: 'concept-lab',
          estimated_minutes: 45
        },
        {
          module_key: 'prompt-to-answer-clinical-workflow',
          title: 'Prompt to Answer Clinical Workflow',
          description: 'Understand tokenization, retrieval, generation, and verification in one flow.',
          lab_type: 'prompt-lab',
          estimated_minutes: 55
        },
        {
          module_key: 'clinical-productivity-automation',
          title: 'Clinical Productivity Automation',
          description: 'Convert repetitive reporting and communication tasks into reliable AI workflows.',
          lab_type: 'automation-lab',
          estimated_minutes: 70
        },
        {
          module_key: 'safe-deployment-checklist',
          title: 'Safe Deployment Checklist',
          description: 'Implement guardrails, escalation paths, and audit steps for day-to-day deployment.',
          lab_type: 'governance-lab',
          estimated_minutes: 40
        }
      ],
      cohort: {
        name: 'Path 1 Spring 2026',
        mode: 'instructor-led',
        status: 'live',
        start_date: '2026-03-20',
        end_date: '2026-05-20',
        fee_cents: 24900
      }
    },
    {
      slug: 'in-silico-investigator-research',
      title: 'In-Silico Investigator: AI Research Accelerator',
      status: 'live',
      price_cents: 29900,
      start_date: '2026-03-18',
      end_date: '2026-05-25',
      created_by: 'coordinator',
      path_key: 'research',
      teacher: {
        user_id: 'teacher_path2',
        email: 'trainer.path2@greybrain.ai',
        display_name: 'Dr Ada Research Mentor'
      },
      modules: [
        {
          module_key: 'hypothesis-methodology-loop',
          title: 'Hypothesis and Methodology Loop',
          description: 'Start with sound research logic before introducing AI acceleration.',
          lab_type: 'methodology-lab',
          estimated_minutes: 50
        },
        {
          module_key: 'literature-synthesis-with-ai',
          title: 'Literature Synthesis With AI',
          description: 'Use AI to speed up literature mapping while retaining citation integrity.',
          lab_type: 'nlp-lab',
          estimated_minutes: 65
        },
        {
          module_key: 'study-design-and-data-logic',
          title: 'Study Design and Data Logic',
          description: 'Translate clinical questions into robust data plans and experiment designs.',
          lab_type: 'regression-lab',
          estimated_minutes: 75
        },
        {
          module_key: 'manuscript-and-peer-review-prep',
          title: 'Manuscript and Peer Review Prep',
          description: 'Convert evidence into publication-ready outputs and reviewer-ready argumentation.',
          lab_type: 'writing-lab',
          estimated_minutes: 55
        }
      ],
      cohort: {
        name: 'Path 2 Spring 2026',
        mode: 'instructor-led',
        status: 'open',
        start_date: '2026-04-01',
        end_date: '2026-06-10',
        fee_cents: 29900
      }
    },
    {
      slug: 'doctor-ai-venture-builder',
      title: 'Doctor AI Venture Builder',
      status: 'published',
      price_cents: 39900,
      start_date: '2026-04-10',
      end_date: '2026-06-30',
      created_by: 'coordinator',
      path_key: 'entrepreneurship',
      teacher: {
        user_id: 'teacher_path3',
        email: 'trainer.path3@greybrain.ai',
        display_name: 'Dr Venture Coach'
      },
      modules: [
        {
          module_key: 'problem-selection-and-validation',
          title: 'Problem Selection and Validation',
          description: 'Select high-value clinical problems and validate demand with structured interviews.',
          lab_type: 'venture-lab',
          estimated_minutes: 60
        },
        {
          module_key: 'no-code-mvp-and-prototype',
          title: 'No-Code MVP and Prototype',
          description: 'Build clinician-safe MVP flows quickly using no-code and AI tooling.',
          lab_type: 'prototype-lab',
          estimated_minutes: 80
        },
        {
          module_key: 'clinical-go-to-market',
          title: 'Clinical Go-To-Market',
          description: 'Design distribution, adoption, and trust pathways for healthcare buyers.',
          lab_type: 'gtm-lab',
          estimated_minutes: 55
        },
        {
          module_key: 'capstone-vc-readiness',
          title: 'Capstone VC Readiness',
          description: 'Prepare capstone narratives, evidence packs, and funding readiness checkpoints.',
          lab_type: 'capstone-lab',
          estimated_minutes: 90
        }
      ],
      cohort: {
        name: 'Path 3 Summer 2026',
        mode: 'instructor-led',
        status: 'draft',
        start_date: '2026-05-05',
        end_date: '2026-07-20',
        fee_cents: 39900
      }
    }
  ]
};

async function main() {
  const stats = {
    organizations_created: 0,
    organizations_reused: 0,
    courses_created: 0,
    courses_reused: 0,
    modules_created: 0,
    modules_reused: 0,
    rubrics_created: 0,
    rubrics_reused: 0,
    cohorts_created: 0,
    cohorts_reused: 0,
    unlocks_created: 0,
    enrollments_upserted: 0,
    completions_marked: 0,
    logistics_docs: 0,
    logistics_chunks: 0
  };

  const orgs = await listOrganizations();
  const orgBySlug = new Map(orgs.map((org) => [org.slug, org]));

  for (const orgSpec of seedSpec.organizations) {
    const existing = orgBySlug.get(orgSpec.slug);
    if (existing) {
      stats.organizations_reused += 1;
      continue;
    }
    const created = await post('/api/admin/organizations', orgSpec);
    orgBySlug.set(orgSpec.slug, created.organization);
    stats.organizations_created += 1;
  }

  const courses = await listCourses();
  const courseBySlug = new Map(courses.map((course) => [course.slug, course]));
  const primaryOrgId = orgBySlug.get('greybrain-academy')?.id || orgs[0]?.id || '';

  for (const courseSpec of seedSpec.courses) {
    let course = courseBySlug.get(courseSpec.slug);
    if (!course) {
      const created = await post('/api/admin/courses', {
        title: courseSpec.title,
        slug: courseSpec.slug,
        status: courseSpec.status,
        price_cents: courseSpec.price_cents,
        start_date: courseSpec.start_date,
        end_date: courseSpec.end_date,
        created_by: courseSpec.created_by
      });
      course = created.course;
      courseBySlug.set(courseSpec.slug, course);
      stats.courses_created += 1;
    } else {
      stats.courses_reused += 1;
    }

    await post(`/api/admin/courses/${course.id}/publish`, { status: courseSpec.status });
    await post(`/api/admin/courses/${course.id}/staff`, { ...courseSpec.teacher, role: 'teacher' });

    const modules = await listModules(course.id);
    const moduleByKey = new Map(modules.map((module) => [module.module_key, module]));
    for (const [idx, moduleSpec] of courseSpec.modules.entries()) {
      let module = moduleByKey.get(moduleSpec.module_key);
      if (!module) {
        const created = await post(`/api/admin/courses/${course.id}/modules`, {
          path_key: courseSpec.path_key,
          module_key: moduleSpec.module_key,
          title: moduleSpec.title,
          description: moduleSpec.description,
          lab_type: moduleSpec.lab_type,
          unlock_policy: 'cohort',
          estimated_minutes: moduleSpec.estimated_minutes,
          sort_order: idx,
          is_published: true
        });
        module = created.module;
        moduleByKey.set(moduleSpec.module_key, module);
        stats.modules_created += 1;
      } else {
        stats.modules_reused += 1;
      }
    }

    const latestModules = await listModules(course.id);
    const rubrics = await listRubrics(course.id);
    const rubricByTitle = new Map(rubrics.map((rubric) => [rubric.title, rubric]));
    for (const module of latestModules) {
      const rubricTitle = `${module.title} Rubric`;
      if (rubricByTitle.has(rubricTitle)) {
        stats.rubrics_reused += 1;
        continue;
      }
      await post(`/api/admin/courses/${course.id}/rubrics`, {
        module_id: module.id,
        title: rubricTitle,
        pass_threshold: 70,
        rubric: {
          criteria: [
            'Clinical clarity and relevance',
            'Methodological correctness',
            'Evidence-backed reasoning',
            'Actionable next steps'
          ],
          scale: '0-100'
        }
      });
      stats.rubrics_created += 1;
    }

    const cohorts = await listCohorts(course.id);
    let cohort = cohorts.find((item) => item.name === courseSpec.cohort.name);
    if (!cohort) {
      const created = await post('/api/admin/cohorts', {
        org_id: primaryOrgId,
        course_id: course.id,
        name: courseSpec.cohort.name,
        mode: courseSpec.cohort.mode,
        status: courseSpec.cohort.status,
        start_date: courseSpec.cohort.start_date,
        end_date: courseSpec.cohort.end_date,
        instructor_user_id: courseSpec.teacher.user_id,
        fee_cents: courseSpec.cohort.fee_cents
      });
      cohort = created.cohort;
      stats.cohorts_created += 1;
    } else {
      stats.cohorts_reused += 1;
    }

    const unlocks = await listUnlocks(cohort.id);
    const unlocked = new Set(unlocks.map((entry) => entry.module_id));
    const modulesToUnlock = latestModules.slice(0, Math.min(2, latestModules.length));
    for (const module of modulesToUnlock) {
      if (unlocked.has(module.id)) continue;
      await post(`/api/admin/cohorts/${cohort.id}/unlocks`, { module_id: module.id });
      stats.unlocks_created += 1;
    }

    const learners = [
      {
        user_id: `${courseSpec.path_key}_learner_001`,
        email: `${courseSpec.path_key}.learner1@greybrain.ai`,
        display_name: `${titleCase(courseSpec.path_key)} Learner One`
      },
      {
        user_id: `${courseSpec.path_key}_learner_002`,
        email: `${courseSpec.path_key}.learner2@greybrain.ai`,
        display_name: `${titleCase(courseSpec.path_key)} Learner Two`
      }
    ];

    for (const learner of learners) {
      await post(`/api/admin/cohorts/${cohort.id}/enroll`, learner);
      stats.enrollments_upserted += 1;
    }

    const completionUser = learners[0].user_id;
    await post(`/api/admin/cohorts/${cohort.id}/enroll/${completionUser}/complete`, {
      certificate_url: `https://gbdeeplearn-assets.r2.dev/certificates/${completionUser}.pdf`
    });
    stats.completions_marked += 1;
  }

  const logistics = await ingestLogisticsContext();
  stats.logistics_docs = Number(logistics?.documents || 0);
  stats.logistics_chunks = Number(logistics?.chunks || 0);

  console.log('\nSeed completed');
  console.table(stats);
  console.log(`API base: ${API_BASE_URL}`);
}

async function listOrganizations() {
  const response = await get('/api/admin/organizations?limit=100');
  return response.organizations || [];
}

async function listCourses() {
  const response = await get('/api/admin/courses?limit=100');
  return response.courses || [];
}

async function listModules(courseId) {
  const response = await get(`/api/admin/courses/${courseId}/modules`);
  return response.modules || [];
}

async function listRubrics(courseId) {
  const response = await get(`/api/admin/courses/${courseId}/rubrics`);
  return response.rubrics || [];
}

async function listCohorts(courseId) {
  const response = await get(`/api/admin/cohorts?limit=100&course_id=${encodeURIComponent(courseId)}`);
  return response.cohorts || [];
}

async function listUnlocks(cohortId) {
  const response = await get(`/api/admin/cohorts/${cohortId}/unlocks`);
  return response.unlocks || [];
}

async function ingestLogisticsContext() {
  return post('/api/admin/knowledge/ingest-logistics', {});
}

async function get(path) {
  return request(path, { method: 'GET' });
}

async function post(path, body) {
  return request(path, { method: 'POST', body });
}

async function request(path, { method, body }) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (ADMIN_TOKEN) headers['x-admin-token'] = ADMIN_TOKEN;
  const url = `${API_BASE_URL}${path}`;
  const bodyJson = body ? JSON.stringify(body) : undefined;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyJson,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || `${method} ${path} failed`;
        const details = payload?.details ? ` :: ${payload.details}` : '';
        throw new Error(`${message}${details}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await sleep(600 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : 'Request failed');
}

function titleCase(input) {
  return String(input)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('Seed failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
