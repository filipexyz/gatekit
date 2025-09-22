-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ProjectEnvironment" AS ENUM ('production', 'staging', 'development', 'custom');

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "environment" "public"."ProjectEnvironment" NOT NULL DEFAULT 'development',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_keys" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_suffix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_key_scopes" (
    "api_key_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "api_key_scopes_pkey" PRIMARY KEY ("api_key_id","scope")
);

-- CreateTable
CREATE TABLE "public"."project_platforms" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "credentials_encrypted" TEXT NOT NULL,
    "webhook_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "test_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_key_usage" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT NOT NULL,

    CONSTRAINT "api_key_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "public"."projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "public"."api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_project_id_idx" ON "public"."api_keys"("project_id");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "public"."api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "project_platforms_webhook_token_key" ON "public"."project_platforms"("webhook_token");

-- CreateIndex
CREATE INDEX "project_platforms_project_id_idx" ON "public"."project_platforms"("project_id");

-- CreateIndex
CREATE INDEX "project_platforms_webhook_token_idx" ON "public"."project_platforms"("webhook_token");

-- CreateIndex
CREATE UNIQUE INDEX "project_platforms_project_id_platform_key" ON "public"."project_platforms"("project_id", "platform");

-- CreateIndex
CREATE INDEX "api_key_usage_api_key_id_idx" ON "public"."api_key_usage"("api_key_id");

-- CreateIndex
CREATE INDEX "api_key_usage_timestamp_idx" ON "public"."api_key_usage"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_key_scopes" ADD CONSTRAINT "api_key_scopes_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_platforms" ADD CONSTRAINT "project_platforms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_key_usage" ADD CONSTRAINT "api_key_usage_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

