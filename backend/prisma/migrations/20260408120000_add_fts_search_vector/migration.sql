-- Manual FTS migration (already applied to production DB)
-- Tracking in Prisma migration history to resolve drift
-- Original: prisma/manual/001_add_search_vector.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_prompts_search_vector
  ON prompts USING GIN(search_vector);

CREATE OR REPLACE FUNCTION prompts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompts_search_vector ON prompts;
CREATE TRIGGER trg_prompts_search_vector
  BEFORE INSERT OR UPDATE OF title, description, content, tags
  ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION prompts_search_vector_update();

UPDATE prompts SET
  search_vector =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(tags, ' '), '')), 'D');

CREATE INDEX IF NOT EXISTS idx_prompts_title_trgm
  ON prompts USING GIN(title gin_trgm_ops);
