-- Mobius Memory Layer
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  loop_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  summary TEXT,
  total_iterations INTEGER DEFAULT 0,
  best_score REAL
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL CHECK (type IN ('fact', 'pattern', 'error', 'skill_suggestion')),
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'expired')),
  superseded_by INTEGER REFERENCES memory_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  metadata_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_entries_session ON memory_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_status ON memory_entries(status);

CREATE TABLE IF NOT EXISTS skill_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_condition TEXT,
  content_markdown TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  occurrence_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'promoted', 'rejected', 'superseded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guardrail_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  hit_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exported_at TEXT NOT NULL DEFAULT (datetime('now')),
  content TEXT NOT NULL,
  entry_count INTEGER NOT NULL,
  triggered_by TEXT NOT NULL
);
