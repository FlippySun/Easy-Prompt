-- CreateTable: scenes (P1.34 — already applied to production DB via db push)
CREATE TABLE "scenes" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "keywords" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenes_category_idx" ON "scenes"("category");

-- CreateIndex
CREATE INDEX "scenes_is_active_idx" ON "scenes"("is_active");
