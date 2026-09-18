CREATE TABLE "v2"."account_state" (
  "user_id" integer PRIMARY KEY REFERENCES "public"."users"("id") ON DELETE RESTRICT,
  "mirror_paused" boolean NOT NULL DEFAULT false,
  "settings_edited" boolean NOT NULL DEFAULT false,
  "excluded_work_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "excluded_goal_ids" jsonb NOT NULL DEFAULT '[]'::jsonb
);
--> statement-breakpoint
ALTER TABLE "v2"."margins" ADD COLUMN "kind" text NOT NULL DEFAULT 'note' CHECK ("kind" IN ('note', 'quote'));
