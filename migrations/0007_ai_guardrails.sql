-- 0007_ai_guardrails.sql
-- Tables for AI Tutor Guardrails (Quizzes) and Automated Certification

-- Stores generated quiz questions for each module
CREATE TABLE IF NOT EXISTS module_quizzes (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL, -- JSON array of strings
    correct_index INTEGER NOT NULL,
    explanation TEXT,
    created_at_ms INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_module_quizzes_module ON module_quizzes(module_id);

-- Tracks learner attempts and pass status
CREATE TABLE IF NOT EXISTS learner_quiz_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    score INTEGER NOT NULL, -- Percentage (0-100)
    passed BOOLEAN NOT NULL,
    attempted_at_ms INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_module ON learner_quiz_attempts(user_id, module_id);

-- Official registry for issued certificates
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL, -- Links to the issued SVG/JSON in R2
    metadata_json TEXT, -- Skills earned, dates, unique share codes
    issued_at_ms INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_artifact ON certificates(artifact_id);
