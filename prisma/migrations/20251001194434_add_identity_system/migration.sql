-- CreateEnum
CREATE TYPE "IdentityLinkMethod" AS ENUM ('manual', 'automatic');

-- CreateTable
CREATE TABLE "identities" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "display_name" TEXT,
    "email" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_aliases" (
    "id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_user_display" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "link_method" "IdentityLinkMethod" NOT NULL DEFAULT 'manual',

    CONSTRAINT "identity_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identities_project_id_idx" ON "identities"("project_id");

-- CreateIndex
CREATE INDEX "identities_project_id_email_idx" ON "identities"("project_id", "email");

-- CreateIndex
CREATE INDEX "identity_aliases_identity_id_idx" ON "identity_aliases"("identity_id");

-- CreateIndex
CREATE INDEX "identity_aliases_project_id_idx" ON "identity_aliases"("project_id");

-- CreateIndex
CREATE INDEX "identity_aliases_provider_user_id_idx" ON "identity_aliases"("provider_user_id");

-- CreateIndex
CREATE INDEX "identity_aliases_platform_id_provider_user_id_idx" ON "identity_aliases"("platform_id", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_aliases_platform_id_provider_user_id_key" ON "identity_aliases"("platform_id", "provider_user_id");

-- CreateIndex
CREATE INDEX "received_messages_platform_id_provider_user_id_idx" ON "received_messages"("platform_id", "provider_user_id");

-- CreateIndex
CREATE INDEX "received_reactions_platform_id_provider_user_id_idx" ON "received_reactions"("platform_id", "provider_user_id");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_aliases" ADD CONSTRAINT "identity_aliases_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_aliases" ADD CONSTRAINT "identity_aliases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_aliases" ADD CONSTRAINT "identity_aliases_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "project_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "received_reactions_platformId_providerMessageId_providerUs_key" RENAME TO "received_reactions_platform_id_provider_message_id_provider_key";

-- RenameIndex
ALTER INDEX "received_reactions_projectId_providerMessageId_providerU_idx" RENAME TO "received_reactions_project_id_provider_message_id_provider__idx";
