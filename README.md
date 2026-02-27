# DeepLearn AI Platform

Hybrid, offline-first LMS scaffold built with Astro + React + Tailwind and Cloudflare Worker APIs.

## Quick start

```bash
npm install
npm run dev
```

## Required env vars

Create `.env` with:

```bash
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_MEASUREMENT_ID=
```

## Worker local dev

```bash
npm run worker:dev
```

Bindings expected by `src/worker.js`:
- `AI` (Workers AI binding for embeddings)
- `DEEPLEARN_INDEX` (Vectorize index binding)
