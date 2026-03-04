-- Drop legacy Stripe columns from subscriptions
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_subscription_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_price_id";

-- Backfill existing rows from 'stripe' to 'polar'
UPDATE "subscriptions" SET "provider" = 'polar' WHERE "provider" = 'stripe';

-- Update default provider from 'stripe' to 'polar' for new rows
ALTER TABLE "subscriptions" ALTER COLUMN "provider" SET DEFAULT 'polar';
