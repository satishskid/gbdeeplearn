# Technical Specifications

## Stack
- **Frontend:** Astro 4.0 + React (for interactive Islands).
- **Styling:** Tailwind CSS.
- **Auth:** Firebase Auth (v9 SDK).
- **State/DB:** Firebase Firestore (v9 SDK).
- **Vector DB:** Cloudflare Vectorize.
- **File Storage:** Cloudflare R2.
- **Serverless:** Cloudflare Workers (Hono framework recommended).
- **AI Inference:** Groq SDK (Llama-3-70b).

## Database Schema (Firestore)

### `users/{uid}`
- `email`: string
- `enrolled_courses`: array<string>
- `completed_modules`: array<string>
- `certificate_url`: string (URL to R2)

### `courses/{courseId}`
- `title`: string
- `modules`: array (JSON structure of syllabus)
- `price`: number
- `is_published`: boolean

### `stats/global` (Counter Document)
- `total_students`: number
- `certificates_issued`: number
- `revenue`: number

## Vector Database Schema (Cloudflare Vectorize)
- **Index Name:** `deeplearn-index`
- **Metadata Fields:**
  - `type`: "logistics" | "content"
  - `course_id`: string
  - `module_id`: string
  - `chunk_text`: string (The actual text content)

## API Endpoints (Cloudflare Workers)

### `POST /api/chat/counselor`
- **Input:** `{ message }`
- **Logic:** Queries Vectorize (filter: `type="logistics"`). Uses SERVER API Key.
- **Output:** Streamed text response.

### `POST /api/chat/tutor`
- **Input:** `{ message, groq_key, current_context_id }`
- **Logic:** Queries Vectorize (filter: `type="content"`). Uses STUDENT API Key.
- **Output:** Streamed text response.

### `POST /api/grade-assignment`
- **Input:** `{ question, answer, groq_key }`
- **Logic:** Retrieves ground truth -> Asks AI to grade -> Updates Firestore if pass.

## Offline Strategy
- **PWA:** Use `@vite-pwa/astro` to cache HTML/CSS/JS shell.
- **Data:** Initialize Firebase with `enableIndexedDbPersistence(db)`.
