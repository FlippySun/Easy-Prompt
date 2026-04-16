-- 2026-04-14 — Zhiz OAuth Superpowers Execute T5
-- 变更类型：安全/Schema 定向迁移
-- 功能描述：将 oauth_accounts.access_token 从 VARCHAR(500) 扩容到 TEXT，承载加密后的 OAuth token。
-- 设计思路：不做额外表结构重构，仅对现有字段做最小扩容，满足 v1 的 OAuth token 加密策略。
-- 影响范围：oauth_accounts.access_token 持久化长度限制。
-- 潜在风险：无已知风险。

ALTER TABLE "oauth_accounts"
ALTER COLUMN "access_token" TYPE TEXT;
