-- Run this in your Supabase SQL Editor to create/update the schema

-- Drop existing table if you want fresh start (uncomment if needed)
-- DROP TABLE IF EXISTS repo_analysis;

-- Repo Analysis Table
CREATE TABLE IF NOT EXISTS repo_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repo VARCHAR(255) NOT NULL UNIQUE,
  last_analyzed TIMESTAMPTZ,
  commit_count INTEGER DEFAULT 0,
  commit_sha VARCHAR(255),
  description TEXT,
  recent_history TEXT,
  direction TEXT,
  analysis_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_repo_analysis_repo ON repo_analysis(repo);

-- Repo Favorites Table
CREATE TABLE IF NOT EXISTS repo_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repo VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_repo_favorites_repo ON repo_favorites(repo);

-- Enable Row Level Security (optional - adjust based on your needs)
ALTER TABLE repo_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_favorites ENABLE ROW LEVEL SECURITY;

-- For public read/write (adjust as needed for your auth setup)
CREATE POLICY "Allow all" ON repo_analysis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON repo_favorites FOR ALL USING (true) WITH CHECK (true);
