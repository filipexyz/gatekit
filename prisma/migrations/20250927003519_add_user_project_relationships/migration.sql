/*
  Migration: Add user-project relationships

  This migration:
  1. Creates the users table and enum
  2. Creates a system user for existing projects
  3. Adds owner_id to projects with proper data migration
  4. Creates project_members table and relationships
*/
-- CreateEnum
CREATE TYPE "public"."ProjectRole" AS ENUM ('owner', 'admin', 'member', 'viewer');

-- CreateTable (Users first)
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "auth0_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create system user for existing projects
INSERT INTO "public"."users" ("id", "auth0_id", "email", "name", "is_admin", "created_at", "updated_at")
VALUES ('system-user-id', 'system|default', 'system@gatekit.dev', 'System User', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add owner_id column with default to system user
ALTER TABLE "public"."projects" ADD COLUMN "owner_id" TEXT NOT NULL DEFAULT 'system-user-id';

-- Remove default constraint (now all projects have an owner)
ALTER TABLE "public"."projects" ALTER COLUMN "owner_id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "public"."ProjectRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_id_key" ON "public"."users"("auth0_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "public"."project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "public"."project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "api_keys_created_by_idx" ON "public"."api_keys"("created_by");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "public"."projects"("owner_id");

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
