ALTER TABLE "v2"."progress_entries" ADD COLUMN "supersedes_id" uuid;
--> statement-breakpoint
ALTER TABLE "v2"."progress_entries" ADD COLUMN "voided" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "v2"."progress_entries" ADD COLUMN "correction_reason" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "progress_session_id" ON "v2"."progress_entries" USING btree ("reading_session_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "progress_single_replacement" ON "v2"."progress_entries" USING btree ("supersedes_id");
--> statement-breakpoint
ALTER TABLE "v2"."progress_entries" ADD CONSTRAINT "progress_replacement_session" FOREIGN KEY ("reading_session_id","supersedes_id") REFERENCES "v2"."progress_entries"("reading_session_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2"."progress_entries" ADD CONSTRAINT "progress_correction_shape" CHECK (("v2"."progress_entries"."supersedes_id" is null and "v2"."progress_entries"."voided" = false and "v2"."progress_entries"."correction_reason" is null) or ("v2"."progress_entries"."supersedes_id" is not null and "v2"."progress_entries"."supersedes_id" <> "v2"."progress_entries"."id" and "v2"."progress_entries"."kind" = 'observation' and "correction_reason" is not null and length(trim("v2"."progress_entries"."correction_reason")) > 0));
