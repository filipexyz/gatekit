-- Add columns with temporary default, then update existing records
ALTER TABLE "public"."project_platforms" ADD COLUMN "description" TEXT;
ALTER TABLE "public"."project_platforms" ADD COLUMN "name" TEXT;

-- Update existing records with platform-based names and random suffixes
UPDATE "public"."project_platforms"
SET "name" = platform || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6)
WHERE "name" IS NULL;

-- Make name column required
ALTER TABLE "public"."project_platforms" ALTER COLUMN "name" SET NOT NULL;
