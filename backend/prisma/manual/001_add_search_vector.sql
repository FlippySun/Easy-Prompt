-- ═══ 手动迁移：为 prompts 表添加全文检索支持 ═══
-- 2026-04-08 新增 — P3.02 Prompt Search (全文检索)
-- 设计思路：
--   1. 启用 pg_trgm 扩展（模糊匹配 + 三元组索引）
--   2. 添加 search_vector (tsvector) 列到 prompts 表
--   3. 创建 GIN 索引加速全文检索
--   4. 创建触发器自动维护 search_vector（INSERT/UPDATE 时重建）
--   5. 回填已有数据的 search_vector
--
-- 分词策略：使用 'simple' 配置（不做词干提取），适用于中英文混合场景
--   title 权重 A（最高）、description 权重 B、content 权重 C、tags 权重 D
--
-- 回滚方式：见文件末尾 ROLLBACK 注释
-- 影响范围：prompts 表（新增列 + 索引 + 触发器）
-- 潜在风险：大数据量回填时锁表，建议在低峰期执行

-- ── Step 1: 启用 pg_trgm 扩展 ──────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Step 2: 添加 search_vector 列 ──────────────────
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── Step 3: 创建 GIN 索引 ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_prompts_search_vector
  ON prompts USING GIN(search_vector);

-- ── Step 4: 创建更新函数 ──────────────────────────
-- 将 title(A) + description(B) + content(C) + tags(D) 合并为 tsvector
-- 使用 'simple' 配置以兼容中文
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

-- ── Step 5: 创建触发器 ──────────────────────────────
DROP TRIGGER IF EXISTS trg_prompts_search_vector ON prompts;
CREATE TRIGGER trg_prompts_search_vector
  BEFORE INSERT OR UPDATE OF title, description, content, tags
  ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION prompts_search_vector_update();

-- ── Step 6: 回填已有数据 ──────────────────────────
UPDATE prompts SET
  search_vector =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(tags, ' '), '')), 'D');

-- ── 额外：为 pg_trgm 模糊搜索创建 trigram 索引 ────
-- 用于 ILIKE 回退场景的加速（可选）
CREATE INDEX IF NOT EXISTS idx_prompts_title_trgm
  ON prompts USING GIN(title gin_trgm_ops);

-- ═══════════════════════════════════════════════════
-- ROLLBACK（回滚命令，按需手动执行）：
-- ═══════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS trg_prompts_search_vector ON prompts;
-- DROP FUNCTION IF EXISTS prompts_search_vector_update();
-- DROP INDEX IF EXISTS idx_prompts_search_vector;
-- DROP INDEX IF EXISTS idx_prompts_title_trgm;
-- ALTER TABLE prompts DROP COLUMN IF EXISTS search_vector;
