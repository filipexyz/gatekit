-- Step 1: Add a temporary column to store the old UUID id
ALTER TABLE "projects" ADD COLUMN "old_id" TEXT;
UPDATE "projects" SET "old_id" = "id";

-- Step 2: Rename slug to new_id temporarily
ALTER TABLE "projects" ADD COLUMN "new_id" TEXT;
UPDATE "projects" SET "new_id" = "slug";

-- Step 3: Drop foreign key constraints
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_project_id_fkey";
ALTER TABLE "project_platforms" DROP CONSTRAINT "project_platforms_project_id_fkey";
ALTER TABLE "received_messages" DROP CONSTRAINT "received_messages_project_id_fkey";
ALTER TABLE "sent_messages" DROP CONSTRAINT "sent_messages_project_id_fkey";
ALTER TABLE "platform_logs" DROP CONSTRAINT "platform_logs_project_id_fkey";
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_project_id_fkey";
ALTER TABLE "received_reactions" DROP CONSTRAINT "received_reactions_project_id_fkey";
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_project_id_fkey";
ALTER TABLE "identities" DROP CONSTRAINT "identities_project_id_fkey";
ALTER TABLE "identity_aliases" DROP CONSTRAINT "identity_aliases_project_id_fkey";

-- Step 4: Update all foreign keys to use the slug value
UPDATE "api_keys" ak SET "project_id" = p."new_id" FROM "projects" p WHERE ak."project_id" = p."old_id";
UPDATE "project_platforms" pp SET "project_id" = p."new_id" FROM "projects" p WHERE pp."project_id" = p."old_id";
UPDATE "received_messages" rm SET "project_id" = p."new_id" FROM "projects" p WHERE rm."project_id" = p."old_id";
UPDATE "sent_messages" sm SET "project_id" = p."new_id" FROM "projects" p WHERE sm."project_id" = p."old_id";
UPDATE "platform_logs" pl SET "project_id" = p."new_id" FROM "projects" p WHERE pl."project_id" = p."old_id";
UPDATE "webhooks" w SET "project_id" = p."new_id" FROM "projects" p WHERE w."project_id" = p."old_id";
UPDATE "received_reactions" rr SET "project_id" = p."new_id" FROM "projects" p WHERE rr."project_id" = p."old_id";
UPDATE "project_members" pm SET "project_id" = p."new_id" FROM "projects" p WHERE pm."project_id" = p."old_id";
UPDATE "identities" i SET "project_id" = p."new_id" FROM "projects" p WHERE i."project_id" = p."old_id";
UPDATE "identity_aliases" ia SET "project_id" = p."new_id" FROM "projects" p WHERE ia."project_id" = p."old_id";

-- Step 5: Drop primary key and old id column
ALTER TABLE "projects" DROP CONSTRAINT "projects_pkey";
ALTER TABLE "projects" DROP COLUMN "id";
ALTER TABLE "projects" DROP COLUMN "slug";
ALTER TABLE "projects" DROP COLUMN "old_id";

-- Step 6: Rename new_id to id and make it primary key
ALTER TABLE "projects" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "projects" ADD PRIMARY KEY ("id");

-- Step 7: Recreate foreign key constraints
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_platforms" ADD CONSTRAINT "project_platforms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "received_messages" ADD CONSTRAINT "received_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_logs" ADD CONSTRAINT "platform_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "received_reactions" ADD CONSTRAINT "received_reactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identities" ADD CONSTRAINT "identities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_aliases" ADD CONSTRAINT "identity_aliases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Add index that was previously on display_name (from another pending migration)
CREATE INDEX "identities_project_id_display_name_idx" ON "identities"("project_id", "display_name");
