CREATE TABLE IF NOT EXISTS "v2"."legacy_sync_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" integer NOT NULL,
  "entity_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "source_hash" text NOT NULL,
  "payload" jsonb NOT NULL,
  "observed_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_sync_entity_kind" CHECK ("entity_kind" in ('book','margin','goal','settings')),
  CONSTRAINT "legacy_sync_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_sync_source_identity" ON "v2"."legacy_sync_snapshots" ("user_id", "entity_kind", "source_id");
