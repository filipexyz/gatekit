-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('added', 'removed');

-- AlterTable
-- Change emoji column from TEXT to VARCHAR(255)
ALTER TABLE "received_reactions" ALTER COLUMN "emoji" TYPE VARCHAR(255);

-- AlterTable
-- Change reaction_type from TEXT to enum
-- Use USING clause to cast existing data
ALTER TABLE "received_reactions"
  ALTER COLUMN "reaction_type" TYPE "ReactionType"
  USING (reaction_type::text::"ReactionType");

-- CreateIndex
-- Add composite index for WhatsApp reaction lookups
CREATE INDEX "received_reactions_projectId_providerMessageId_providerU_idx" ON "received_reactions"("project_id", "provider_message_id", "provider_user_id", "reaction_type", "received_at");
