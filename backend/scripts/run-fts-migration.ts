/**
 * 执行全文检索迁移脚本（通过 Prisma $executeRawUnsafe）
 * 2026-04-08 — P3.02 search_vector 迁移
 * 用法：DATABASE_URL="..." npx tsx scripts/run-fts-migration.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

  `ALTER TABLE prompts ADD COLUMN IF NOT EXISTS search_vector tsvector`,

  `CREATE INDEX IF NOT EXISTS idx_prompts_search_vector ON prompts USING GIN(search_vector)`,

  `CREATE OR REPLACE FUNCTION prompts_search_vector_update() RETURNS trigger AS $fn$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_prompts_search_vector ON prompts`,

  `CREATE TRIGGER trg_prompts_search_vector BEFORE INSERT OR UPDATE OF title, description, content, tags ON prompts FOR EACH ROW EXECUTE FUNCTION prompts_search_vector_update()`,

  `UPDATE prompts SET search_vector =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(tags, ' '), '')), 'D')`,

  `CREATE INDEX IF NOT EXISTS idx_prompts_title_trgm ON prompts USING GIN(title gin_trgm_ops)`,
];

async function main() {
  console.log('Connecting to database...');

  for (let i = 0; i < STATEMENTS.length; i++) {
    const label = `Step ${i + 1}/${STATEMENTS.length}`;
    try {
      await prisma.$executeRawUnsafe(STATEMENTS[i]);
      console.log(`${label}: OK`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${label} FAILED: ${msg}`);
      throw err;
    }
  }

  console.log('All migration steps completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
