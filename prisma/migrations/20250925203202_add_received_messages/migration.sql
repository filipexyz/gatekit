-- CreateTable
CREATE TABLE "public"."received_messages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "provider_chat_id" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "user_display" TEXT,
    "message_text" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "raw_data" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "received_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "received_messages_project_id_idx" ON "public"."received_messages"("project_id");

-- CreateIndex
CREATE INDEX "received_messages_platform_id_idx" ON "public"."received_messages"("platform_id");

-- CreateIndex
CREATE INDEX "received_messages_received_at_idx" ON "public"."received_messages"("received_at");

-- CreateIndex
CREATE INDEX "received_messages_provider_chat_id_idx" ON "public"."received_messages"("provider_chat_id");

-- CreateIndex
CREATE INDEX "received_messages_provider_user_id_idx" ON "public"."received_messages"("provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "received_messages_platform_id_provider_message_id_key" ON "public"."received_messages"("platform_id", "provider_message_id");

-- AddForeignKey
ALTER TABLE "public"."received_messages" ADD CONSTRAINT "received_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."received_messages" ADD CONSTRAINT "received_messages_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."project_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
