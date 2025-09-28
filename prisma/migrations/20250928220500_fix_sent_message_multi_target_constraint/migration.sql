-- DropIndex
DROP INDEX "public"."sent_messages_job_id_key";

-- CreateIndex
CREATE INDEX "sent_messages_job_id_idx" ON "public"."sent_messages"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "sent_messages_job_id_platform_id_target_chat_id_key" ON "public"."sent_messages"("job_id", "platform_id", "target_chat_id");