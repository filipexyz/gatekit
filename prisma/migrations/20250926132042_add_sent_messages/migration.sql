-- CreateTable
CREATE TABLE "public"."sent_messages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "job_id" TEXT,
    "provider_message_id" TEXT,
    "target_chat_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "target_type" TEXT NOT NULL,
    "message_text" TEXT,
    "message_content" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_messages_project_id_idx" ON "public"."sent_messages"("project_id");

-- CreateIndex
CREATE INDEX "sent_messages_platform_id_idx" ON "public"."sent_messages"("platform_id");

-- CreateIndex
CREATE INDEX "sent_messages_status_idx" ON "public"."sent_messages"("status");

-- CreateIndex
CREATE INDEX "sent_messages_created_at_idx" ON "public"."sent_messages"("created_at");

-- CreateIndex
CREATE INDEX "sent_messages_target_chat_id_idx" ON "public"."sent_messages"("target_chat_id");

-- CreateIndex
CREATE INDEX "sent_messages_target_user_id_idx" ON "public"."sent_messages"("target_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sent_messages_job_id_key" ON "public"."sent_messages"("job_id");

-- AddForeignKey
ALTER TABLE "public"."sent_messages" ADD CONSTRAINT "sent_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sent_messages" ADD CONSTRAINT "sent_messages_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."project_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
