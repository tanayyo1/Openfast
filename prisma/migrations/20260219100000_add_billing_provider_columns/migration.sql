-- Add provider-agnostic columns
ALTER TABLE "subscriptions" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "subscriptions" ADD COLUMN "provider_customer_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "provider_subscription_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "provider_price_id" TEXT;

-- Make stripe_customer_id nullable (Polar subscriptions won't have one)
ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;

-- Backfill provider columns from existing Stripe data
UPDATE "subscriptions"
SET "provider_customer_id" = "stripe_customer_id",
    "provider_subscription_id" = "stripe_subscription_id",
    "provider_price_id" = "stripe_price_id"
WHERE "provider" = 'stripe';
