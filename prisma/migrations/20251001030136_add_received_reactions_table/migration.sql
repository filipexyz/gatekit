-- CreateTable
CREATE TABLE "public"."received_reactions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "provider_chat_id" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "user_display" TEXT,
    "emoji" TEXT NOT NULL,
    "reaction_type" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "received_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "received_reactions_project_id_idx" ON "public"."received_reactions"("project_id");

-- CreateIndex
CREATE INDEX "received_reactions_platform_id_idx" ON "public"."received_reactions"("platform_id");

-- CreateIndex
CREATE INDEX "received_reactions_received_at_idx" ON "public"."received_reactions"("received_at");

-- CreateIndex
CREATE INDEX "received_reactions_provider_chat_id_idx" ON "public"."received_reactions"("provider_chat_id");

-- CreateIndex
CREATE INDEX "received_reactions_provider_user_id_idx" ON "public"."received_reactions"("provider_user_id");

-- CreateIndex
CREATE INDEX "received_reactions_provider_message_id_idx" ON "public"."received_reactions"("provider_message_id");

-- CreateIndex
CREATE INDEX "received_reactions_reaction_type_idx" ON "public"."received_reactions"("reaction_type");

-- AddForeignKey
ALTER TABLE "public"."received_reactions" ADD CONSTRAINT "received_reactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."received_reactions" ADD CONSTRAINT "received_reactions_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."project_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
