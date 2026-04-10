-- 2026-04-10 新增 — 增强日志全文搜索支持
-- 变更类型：新增
-- 设计思路：
--   为 ai_request_logs 表添加 tsvector 列 + GIN 索引 + 自动更新触发器，
--   支持管理后台「增强日志」页面的关键词全文搜索。
--   使用 'simple' 分词配置（对中文逐字切分，无需额外扩展），
--   配合 pg_trgm ILIKE 作为双路兜底策略。
-- 影响范围：ai_request_logs 表
-- 潜在风险：回填大表时可能耗时（<10W 行约数秒）

-- 确保 pg_trgm 扩展可用（已在 prompts FTS migration 中创建，此处幂等）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. 添加 tsvector 列
ALTER TABLE ai_request_logs
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. 创建 GIN 索引（全文搜索）
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_search_vector
  ON ai_request_logs USING GIN(search_vector);

-- 3. 创建 trigram 索引（ILIKE 兜底加速）
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_original_input_trgm
  ON ai_request_logs USING GIN(original_input gin_trgm_ops);

-- 4. 创建触发器函数：INSERT/UPDATE 时自动更新 search_vector
--    权重分配：original_input(A 最高权重) + ai_output(B 次要权重)
CREATE OR REPLACE FUNCTION ai_request_logs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.original_input, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.ai_output, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 绑定触发器（幂等：先删后建）
DROP TRIGGER IF EXISTS trg_ai_request_logs_search_vector ON ai_request_logs;
CREATE TRIGGER trg_ai_request_logs_search_vector
  BEFORE INSERT OR UPDATE OF original_input, ai_output
  ON ai_request_logs
  FOR EACH ROW
  EXECUTE FUNCTION ai_request_logs_search_vector_update();

-- 6. 回填现有行的 search_vector
UPDATE ai_request_logs SET
  search_vector =
    setweight(to_tsvector('simple', COALESCE(original_input, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(ai_output, '')), 'B')
WHERE search_vector IS NULL;
