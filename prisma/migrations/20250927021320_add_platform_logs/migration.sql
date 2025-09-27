-- CreateTable
CREATE TABLE "public"."platform_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform_id" TEXT,
    "platform" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_logs_project_id_idx" ON "public"."platform_logs"("project_id");

-- CreateIndex
CREATE INDEX "platform_logs_platform_id_idx" ON "public"."platform_logs"("platform_id");

-- CreateIndex
CREATE INDEX "platform_logs_timestamp_idx" ON "public"."platform_logs"("timestamp");

-- CreateIndex
CREATE INDEX "platform_logs_level_idx" ON "public"."platform_logs"("level");

-- CreateIndex
CREATE INDEX "platform_logs_category_idx" ON "public"."platform_logs"("category");

-- AddForeignKey
ALTER TABLE "public"."platform_logs" ADD CONSTRAINT "platform_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_logs" ADD CONSTRAINT "platform_logs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."project_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
