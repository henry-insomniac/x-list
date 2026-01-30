CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS tweets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NULL,
  content text NOT NULL,
  author text NULL,
  url text NOT NULL UNIQUE,
  tweet_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tweets_updated_at ON tweets;
CREATE TRIGGER set_tweets_updated_at
BEFORE UPDATE ON tweets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS tweets_created_at_id_idx
  ON tweets (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS tweets_title_trgm_idx
  ON tweets USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tweets_content_trgm_idx
  ON tweets USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tweets_author_trgm_idx
  ON tweets USING GIN (author gin_trgm_ops);

