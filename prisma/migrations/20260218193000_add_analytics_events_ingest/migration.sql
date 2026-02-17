-- RED-79A: analytics event pipeline storage
CREATE TABLE "analytics_events" (
  "id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "anonymous_session_id" TEXT,
  "source" TEXT NOT NULL,
  "page" TEXT,
  "properties" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "event_ts" TIMESTAMP(3) NOT NULL,
  "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "analytics_events"
ADD CONSTRAINT "analytics_events_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "analytics_events"
ADD CONSTRAINT "analytics_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "analytics_events_workspace_id_event_ts_idx"
ON "analytics_events"("workspace_id", "event_ts");

CREATE INDEX "analytics_events_event_name_event_ts_idx"
ON "analytics_events"("event_name", "event_ts");

CREATE INDEX "analytics_events_anonymous_session_id_event_ts_idx"
ON "analytics_events"("anonymous_session_id", "event_ts");
