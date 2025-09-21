/*
  Warnings:

  - Added the required column `key_suffix` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."api_keys" ADD COLUMN     "key_suffix" TEXT NOT NULL DEFAULT 'xxxx';

-- Update existing records with last 4 chars of key_prefix as a temporary measure
UPDATE "public"."api_keys" SET "key_suffix" = SUBSTRING("key_prefix" FROM LENGTH("key_prefix") - 3);

-- Remove the default after updating existing records
ALTER TABLE "public"."api_keys" ALTER COLUMN "key_suffix" DROP DEFAULT;
