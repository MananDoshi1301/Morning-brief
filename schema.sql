CREATE TABLE IF NOT EXISTS briefs (
  date TEXT PRIMARY KEY,          -- local (PT) date
  status TEXT NOT NULL,           -- running | built | sent | failed
  html TEXT,                      -- emailed version
  data TEXT,                      -- JSON the reader app renders; never rewritten after send
  missing TEXT,                   -- JSON array of sources that failed
  error TEXT,                     -- why a run failed
  created INTEGER NOT NULL,
  sent INTEGER
);
CREATE VIRTUAL TABLE IF NOT EXISTS briefs_fts USING fts5(date UNINDEXED, body);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,            -- hash of canonical URL; also stops repeats across days
  brief_date TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  topic TEXT,
  published INTEGER,
  summary TEXT,
  why TEXT,
  score REAL,
  shown INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  saved_at INTEGER,
  read INTEGER NOT NULL DEFAULT 0,
  vote INTEGER NOT NULL DEFAULT 0  -- latest thumbs for the UI; weights come from feedback
);
CREATE INDEX IF NOT EXISTS items_saved ON items(saved) WHERE saved = 1;

CREATE TABLE IF NOT EXISTS feedback (
  item_id TEXT NOT NULL,
  source TEXT NOT NULL,
  vote INTEGER NOT NULL,          -- +1 / -1, at most one row per item
  reason TEXT,                    -- optional "why" after a thumbs down
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,            -- YouTube video id
  channel TEXT NOT NULL,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumb TEXT,
  description TEXT,
  published INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,  -- refreshed while the video is still in its channel's feed
  short INTEGER NOT NULL DEFAULT 0,
  watched INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS videos_published ON videos(published);
