"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type Props = {
  eventName: string;
  source?: "web_public" | "web_app" | "server";
  onceKey?: string;
  properties?: Record<string, unknown>;
};

export function AnalyticsBeacon({
  eventName,
  source,
  onceKey,
  properties,
}: Props) {
  useEffect(() => {
    void trackAnalyticsEvent({ eventName, source, onceKey, properties });
  }, [eventName, onceKey, properties, source]);

  return null;
}
