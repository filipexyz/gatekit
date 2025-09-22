-- DropIndex
DROP INDEX "public"."project_platforms_project_id_platform_key";

-- CreateIndex
CREATE INDEX "project_platforms_project_id_platform_idx" ON "public"."project_platforms"("project_id", "platform");
