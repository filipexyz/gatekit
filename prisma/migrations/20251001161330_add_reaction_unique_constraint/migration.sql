-- Step 1: Delete duplicate reactions (keep oldest for each unique key)
-- This removes duplicates caused by missing unique constraint
DELETE FROM "received_reactions"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "received_reactions"
  GROUP BY "platform_id", "provider_message_id", "provider_user_id", "emoji", "reaction_type"
);

-- Step 2: Add unique constraint to prevent future duplicates
-- This handles platform retry duplicates while allowing users to re-react after removing
CREATE UNIQUE INDEX "received_reactions_platformId_providerMessageId_providerUs_key" ON "received_reactions"("platform_id", "provider_message_id", "provider_user_id", "emoji", "reaction_type");
