-- CreateTable
CREATE TABLE "public"."webhooks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response_code" INTEGER,
    "response_body" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhooks_project_id_idx" ON "public"."webhooks"("project_id");

-- CreateIndex
CREATE INDEX "webhooks_project_id_is_active_idx" ON "public"."webhooks"("project_id", "is_active");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "public"."webhook_deliveries"("webhook_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_created_at_idx" ON "public"."webhook_deliveries"("created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_idx" ON "public"."webhook_deliveries"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_idx" ON "public"."webhook_deliveries"("event");

-- AddForeignKey
ALTER TABLE "public"."webhooks" ADD CONSTRAINT "webhooks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
