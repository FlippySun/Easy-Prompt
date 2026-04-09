-- Phase 6: Cross-platform Enhancements
-- 2026-04-09 — EnhanceHistory + OAuthAccount + Scene.nameEn
-- NOTE: search_vector on prompts is managed outside Prisma (manual/001_add_search_vector.sql)

-- AlterTable: Add name_en to scenes for i18n (P6.04)
ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(100);

-- CreateTable: enhance_histories (P6.01 — cross-device history sync)
CREATE TABLE "enhance_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(64) NOT NULL,
    "input_text" TEXT NOT NULL,
    "output_text" TEXT NOT NULL,
    "scene" VARCHAR(50),
    "model" VARCHAR(100),
    "client_type" VARCHAR(20),
    "enhance_mode" VARCHAR(20),
    "language" VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enhance_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: oauth_accounts (P6.03 — OAuth integration)
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "access_token" VARCHAR(500),
    "raw_profile" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enhance_histories_user_id_created_at_idx" ON "enhance_histories"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "enhance_histories_user_id_client_id_key" ON "enhance_histories"("user_id", "client_id");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_id_key" ON "oauth_accounts"("provider", "provider_id");

-- AddForeignKey
ALTER TABLE "enhance_histories" ADD CONSTRAINT "enhance_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
