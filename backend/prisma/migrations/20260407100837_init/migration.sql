-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100),
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(500),
    "bio" TEXT,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" VARCHAR(50) NOT NULL,
    "model" VARCHAR(50),
    "author_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "copies_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(10),
    "gradient_from" VARCHAR(20),
    "gradient_to" VARCHAR(20),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" VARCHAR(20),
    "estimated_time" VARCHAR(50),
    "created_by" UUID,
    "saved_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_prompts" (
    "collection_id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_prompts_pkey" PRIMARY KEY ("collection_id","prompt_id")
);

-- CreateTable
CREATE TABLE "user_likes" (
    "user_id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_likes_pkey" PRIMARY KEY ("user_id","prompt_id")
);

-- CreateTable
CREATE TABLE "user_saves" (
    "user_id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_saves_pkey" PRIMARY KEY ("user_id","prompt_id")
);

-- CreateTable
CREATE TABLE "user_collection_saves" (
    "user_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_collection_saves_pkey" PRIMARY KEY ("user_id","collection_id")
);

-- CreateTable
CREATE TABLE "user_copies" (
    "user_id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_copied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_copies_pkey" PRIMARY KEY ("user_id","prompt_id")
);

-- CreateTable
CREATE TABLE "user_views" (
    "user_id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_views_pkey" PRIMARY KEY ("user_id","prompt_id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(10),
    "color" VARCHAR(20),
    "category" VARCHAR(50),
    "rarity" VARCHAR(20),
    "condition_type" VARCHAR(50),
    "condition_value" INTEGER,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "user_id" UUID NOT NULL,
    "achievement_id" VARCHAR(50) NOT NULL,
    "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id","achievement_id")
);

-- CreateTable
CREATE TABLE "user_visited_categories" (
    "user_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "first_visited" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_visited_categories_pkey" PRIMARY KEY ("user_id","category")
);

-- CreateTable
CREATE TABLE "categories" (
    "slug" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "label_en" VARCHAR(100),
    "emoji" VARCHAR(10),
    "icon" VARCHAR(30),
    "color" VARCHAR(20),
    "bg_color" VARCHAR(20),
    "dark_bg_color" VARCHAR(30),
    "dark_color" VARCHAR(20),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "models" (
    "slug" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "models_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "api_mode" VARCHAR(20) NOT NULL,
    "base_url" VARCHAR(500) NOT NULL,
    "api_key" VARCHAR(500) NOT NULL,
    "default_model" VARCHAR(100) NOT NULL,
    "models" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_rpm" INTEGER NOT NULL DEFAULT 60,
    "max_tokens" INTEGER NOT NULL DEFAULT 4096,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "extra_headers" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "client_type" VARCHAR(20) NOT NULL,
    "client_version" VARCHAR(20),
    "client_platform" VARCHAR(20),
    "language" VARCHAR(10),
    "ip_address" INET,
    "user_agent" TEXT,
    "fingerprint" VARCHAR(64),
    "country" VARCHAR(10),
    "region" VARCHAR(100),
    "enhance_mode" VARCHAR(20),
    "original_input" TEXT NOT NULL,
    "router_result" JSONB,
    "system_prompt" TEXT,
    "ai_output" TEXT,
    "scene_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_composite" BOOLEAN NOT NULL DEFAULT false,
    "provider_id" UUID,
    "provider_slug" VARCHAR(50),
    "model_used" VARCHAR(100),
    "api_mode" VARCHAR(20),
    "duration_ms" INTEGER,
    "router_duration_ms" INTEGER,
    "gen_duration_ms" INTEGER,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "estimated_cost" DECIMAL(10,6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "date" DATE NOT NULL,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "total_copies" INTEGER NOT NULL DEFAULT 0,
    "total_likes" INTEGER NOT NULL DEFAULT 0,
    "new_prompts" INTEGER NOT NULL DEFAULT 0,
    "new_users" INTEGER NOT NULL DEFAULT 0,
    "ai_requests" INTEGER NOT NULL DEFAULT 0,
    "ai_tokens" INTEGER NOT NULL DEFAULT 0,
    "ai_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ai_errors" INTEGER NOT NULL DEFAULT 0,
    "ai_req_vscode" INTEGER NOT NULL DEFAULT 0,
    "ai_req_browser" INTEGER NOT NULL DEFAULT 0,
    "ai_req_web" INTEGER NOT NULL DEFAULT 0,
    "ai_req_intellij" INTEGER NOT NULL DEFAULT 0,
    "ai_req_webhub" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "blacklist_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(20) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "violation_level" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "blocked_by" UUID,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'block',
    "expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_violations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(20) NOT NULL,
    "entity_value" VARCHAR(255) NOT NULL,
    "violation_count" INTEGER NOT NULL DEFAULT 1,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "last_window_hits" INTEGER NOT NULL DEFAULT 0,
    "last_threshold" INTEGER NOT NULL DEFAULT 0,
    "last_violation_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_rule_id" UUID,
    "last_unban_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "prompts_category_idx" ON "prompts"("category");

-- CreateIndex
CREATE INDEX "prompts_status_idx" ON "prompts"("status");

-- CreateIndex
CREATE INDEX "prompts_author_id_idx" ON "prompts"("author_id");

-- CreateIndex
CREATE INDEX "prompts_likes_count_idx" ON "prompts"("likes_count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_slug_key" ON "ai_providers"("slug");

-- CreateIndex
CREATE INDEX "ai_request_logs_user_id_created_at_idx" ON "ai_request_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_provider_id_created_at_idx" ON "ai_request_logs"("provider_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_status_created_at_idx" ON "ai_request_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_ip_address_idx" ON "ai_request_logs"("ip_address");

-- CreateIndex
CREATE INDEX "ai_request_logs_fingerprint_idx" ON "ai_request_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "ai_request_logs_client_type_created_at_idx" ON "ai_request_logs"("client_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_request_id_idx" ON "ai_request_logs"("request_id");

-- CreateIndex
CREATE INDEX "blacklist_rules_type_value_idx" ON "blacklist_rules"("type", "value");

-- CreateIndex
CREATE INDEX "blacklist_rules_expires_at_idx" ON "blacklist_rules"("expires_at");

-- CreateIndex
CREATE INDEX "blacklist_rules_source_idx" ON "blacklist_rules"("source");

-- CreateIndex
CREATE UNIQUE INDEX "blacklist_rules_type_value_key" ON "blacklist_rules"("type", "value");

-- CreateIndex
CREATE INDEX "rate_violations_entity_type_entity_value_idx" ON "rate_violations"("entity_type", "entity_value");

-- CreateIndex
CREATE INDEX "rate_violations_current_level_idx" ON "rate_violations"("current_level");

-- CreateIndex
CREATE UNIQUE INDEX "rate_violations_entity_type_entity_value_key" ON "rate_violations"("entity_type", "entity_value");

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_prompts" ADD CONSTRAINT "collection_prompts_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_prompts" ADD CONSTRAINT "collection_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_likes" ADD CONSTRAINT "user_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_likes" ADD CONSTRAINT "user_likes_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_saves" ADD CONSTRAINT "user_collection_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_saves" ADD CONSTRAINT "user_collection_saves_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_copies" ADD CONSTRAINT "user_copies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_copies" ADD CONSTRAINT "user_copies_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_visited_categories" ADD CONSTRAINT "user_visited_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_rules" ADD CONSTRAINT "blacklist_rules_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_violations" ADD CONSTRAINT "rate_violations_active_rule_id_fkey" FOREIGN KEY ("active_rule_id") REFERENCES "blacklist_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
