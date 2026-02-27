# Product Requirements Document: DeepLearn AI Platform

## 1. Overview
A static-first, edge-deployed course platform that serves interactive HTML content, audio overviews (NotebookLM style), and provides two distinct AI agents: a Counselor for pre-sales and a Tutor for deep learning.

## 2. User Roles
- **Visitor:** Can view landing page, talk to AI Counselor, register/pay.
- **Student:** Can login, view course content (offline), chat with AI Tutor (online), submit assignments.
- **Admin (Teacher):** Can view analytics (enrollment, completion), upload content to RAG.

## 3. Core Features
### A. The "AI Counselor" (Landing Page)
- **Goal:** Convert visitors to students.
- **Data Source:** `logistics` vector namespace (FAQs, pricing, dates).
- **Behavior:** Friendly, persuasive, concise.

### B. The "AI Tutor" (Learning Mode)
- **Goal:** Deep understanding and assignment grading.
- **Data Source:** `course_material` vector namespace (PDFs, Transcripts, HTML Slides).
- **Mechanism:** BYOK (Student provides Groq API Key).
- **Behavior:** Socratic, grounded in syllabus, strictly academic.

### C. Offline-First Architecture
- **Mechanism:** Firebase Firestore `enableIndexedDbPersistence`.
- **Experience:** If internet drops, Student can still read text content, view previous chats, and navigate the app shell.

### D. Analytics & Certification
- **Metrics:** Total Enrolled, Active Learners, Completion Rate.
- **Certification:** Auto-generated PDF upon 100% completion (stored in R2).

## 4. Technical Constraints
- **Frontend:** Astro (SSR + Static Hybrid).
- **Database:** Firebase Firestore (Free Tier optimized).
- **Vector DB:** Cloudflare Vectorize.
- **Storage:** Cloudflare R2 (Audio/PDFs).
- **Compute:** Cloudflare Workers.
