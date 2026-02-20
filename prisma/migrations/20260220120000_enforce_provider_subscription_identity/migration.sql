-- Enforce provider-scoped subscription identity uniqueness.
ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_provider_provider_subscription_id_key"
UNIQUE ("provider", "provider_subscription_id");
