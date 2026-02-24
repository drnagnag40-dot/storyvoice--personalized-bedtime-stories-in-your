-- =============================================================================
-- StoryVoice Phase 2: Cloud Data Schema
-- Apply this in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/<your-project>/sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Shared updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. child_profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS child_profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  birthday    DATE,
  age         INTEGER,
  interests   TEXT[]      NOT NULL DEFAULT '{}',
  life_notes  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_profiles_select" ON child_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "child_profiles_insert" ON child_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "child_profiles_update" ON child_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "child_profiles_delete" ON child_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER child_profiles_updated_at
  BEFORE UPDATE ON child_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. voice_profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_profiles (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id                  UUID        REFERENCES child_profiles(id) ON DELETE SET NULL,
  voice_type                TEXT        NOT NULL CHECK (voice_type IN ('mom', 'dad', 'custom')),
  voice_name                TEXT,
  recording_url             TEXT,
  duration_seconds          INTEGER     NOT NULL DEFAULT 0,
  script_paragraphs_recorded INTEGER    NOT NULL DEFAULT 0,
  is_complete               BOOLEAN     NOT NULL DEFAULT FALSE,
  recording_labels          JSONB       NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_profiles_select" ON voice_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "voice_profiles_insert" ON voice_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "voice_profiles_update" ON voice_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "voice_profiles_delete" ON voice_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER voice_profiles_updated_at
  BEFORE UPDATE ON voice_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. stories
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id    UUID        REFERENCES child_profiles(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  content     TEXT,
  image_url   TEXT,
  theme       TEXT,
  is_favorite BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select" ON stories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "stories_insert" ON stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_update" ON stories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_delete" ON stories
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for fast user story lookups
CREATE INDEX IF NOT EXISTS stories_user_id_created_at_idx
  ON stories (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. user_preferences
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_voice_id       UUID        REFERENCES voice_profiles(id) ON DELETE SET NULL,
  active_child_id       UUID        REFERENCES child_profiles(id) ON DELETE SET NULL,
  narrator_type         TEXT        CHECK (narrator_type IN ('mom', 'dad', 'custom')),
  notifications_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  last_sync_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_delete" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. users (profile table — referenced by existing code)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  full_name  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete" ON users
  FOR DELETE USING (auth.uid() = id);

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
