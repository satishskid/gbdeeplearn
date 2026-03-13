import React, { useState } from 'react';

export default function PlatformManuals() {
  const [activeManual, setActiveManual] = useState('user');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveManual('user')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition ${
            activeManual === 'user' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Learner Operations Manual
        </button>
        <button
          onClick={() => setActiveManual('tech')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition ${
            activeManual === 'tech' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Platform Technical Manual
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {activeManual === 'user' ? <UserManual /> : <TechManual />}
      </div>
    </div>
  );
}

function UserManual() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-black tracking-tight text-slate-900">Learner Operations Manual</h1>
      <p className="lead text-lg text-slate-600">The authoritative guide for coordinators managing the GreyBrain learner lifecycle.</p>
      
      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">1. Onboarding Flow</h2>
        <p>Learners enter the system primarily through the <strong>Registration & Payment</strong> form. Once paid:</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>A student record is created in the D1 database.</li>
          <li>A welcome email is dispatched via the <code>ONBOARDING_QUEUE</code>.</li>
          <li>The student gains access to the <strong>Learner Workspace</strong>.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">2. Managed Mastery (Guardrails)</h2>
        <p>Self-paced tracks are protected by <strong>AI Knowledge Checks</strong>. Coordinators can monitor pass rates in the CRM or RAG Health tabs. If a student is stuck, you can provide manual intervention or reset their quiz attempts via the admin panel.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">3. Live Teaching Operations</h2>
        <p>Sessions must be created for each cohort. When a session is "Live":</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>The "Join Session" button appears in the Learner Workspace.</li>
          <li>Attendance is logged automatically upon entry.</li>
          <li>WebRTC recordings are suggested for asynchronous review.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">4. Certification & Graduation</h2>
        <p>Certification is the final gate. A coordinator must finalize the last assignment for a module. Upon setting <code>passed: true</code>, the certificate is immutably recorded.</p>
      </section>
    </article>
  );
}

function TechManual() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-black tracking-tight text-slate-900">Platform Technical Manual</h1>
      <p className="lead text-lg text-slate-600">Architectural specifications and system internals for gb-baas.</p>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">1. Tech Stack Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <h3 className="font-bold text-slate-900">Frontend</h3>
            <p className="text-sm text-slate-600">Astro (SSR/Static), React (Interactive components), TailwindCSS.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <h3 className="font-bold text-slate-900">Backend</h3>
            <p className="text-sm text-slate-600">Cloudflare Workers (Hono API), D1 (SQL Storage), KV (Configuration).</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">2. Identity & Access</h2>
        <p>The system uses <strong>Firebase Auth</strong> for identity. Roles (<code>learner</code>, <code>teacher</code>, <code>coordinator</code>, <code>cto</code>) are stored in the <code>actors</code> table and resolved via the <code>resolveActorContext</code> middleware in <code>worker.js</code>.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">3. AI & RAG Engine</h2>
        <p>The <strong>Intelligence Engine</strong> leverages Gemini Pro 1.5. Vectorization is handled by Cloudflare Vectorize (<code>deeplearn-index</code>). Curricula are chunked and ingested into the vector store for context-aware tutoring.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">4. Scaling & Deployment</h2>
        <p>Deployment is orchestrated via <code>npm run cf:deploy:all</code>. This pushes the Astro build to Pages and the Hono service to Workers. Ensure <code>wrangler.toml</code> has correct bindings for D1 and AI.</p>
      </section>
    </article>
  );
}
