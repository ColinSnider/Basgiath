CREATE SCHEMA "v2";
--> statement-breakpoint
CREATE TABLE "v2"."editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"format" text NOT NULL,
	"page_count" integer,
	"duration_seconds" integer,
	"language" text,
	CONSTRAINT "edition_format" CHECK ("v2"."editions"."format" in ('book', 'audiobook', 'ebook', 'unknown')),
	CONSTRAINT "edition_positive_pages" CHECK ("v2"."editions"."page_count" is null or "v2"."editions"."page_count" > 0),
	CONSTRAINT "edition_positive_duration" CHECK ("v2"."editions"."duration_seconds" is null or "v2"."editions"."duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "v2"."external_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"entity_kind" text NOT NULL,
	"external_id" text NOT NULL,
	"work_id" uuid NOT NULL,
	"edition_id" uuid,
	CONSTRAINT "mapping_target_kind" CHECK (("v2"."external_mappings"."entity_kind" = 'work' and "v2"."external_mappings"."edition_id" is null) or ("v2"."external_mappings"."entity_kind" in ('edition', 'volume') and "v2"."external_mappings"."edition_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "v2"."mutation_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"key" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "v2"."progress_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reading_session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_kind" CHECK ("v2"."progress_entries"."kind" in ('baseline', 'observation')),
	CONSTRAINT "entry_position" CHECK ("v2"."progress_entries"."position" >= 0),
	CONSTRAINT "observed_date" CHECK ("v2"."progress_entries"."kind" = 'baseline' or "v2"."progress_entries"."occurred_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "v2"."reading_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_book_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"edition_id" uuid,
	"state" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"unit" text NOT NULL,
	"total" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "session_state" CHECK ("v2"."reading_sessions"."state" in ('active', 'paused', 'completed', 'dnf')),
	CONSTRAINT "progress_unit" CHECK ("v2"."reading_sessions"."unit" in ('page', 'second', 'percent')),
	CONSTRAINT "percent_total" CHECK ("v2"."reading_sessions"."unit" <> 'percent' or "v2"."reading_sessions"."total" is not null),
	CONSTRAINT "session_positions" CHECK ("v2"."reading_sessions"."position" >= 0 and ("v2"."reading_sessions"."total" is null or ("v2"."reading_sessions"."total" > 0 and "v2"."reading_sessions"."position" <= "v2"."reading_sessions"."total")) and ("v2"."reading_sessions"."unit" <> 'percent' or "v2"."reading_sessions"."total" = 100)),
	CONSTRAINT "session_dates" CHECK (("v2"."reading_sessions"."state" not in ('active', 'paused') or "v2"."reading_sessions"."finished_at" is null) and ("v2"."reading_sessions"."started_at" is null or "v2"."reading_sessions"."finished_at" is null or "v2"."reading_sessions"."finished_at" >= "v2"."reading_sessions"."started_at"))
);
--> statement-breakpoint
CREATE TABLE "v2"."user_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"work_id" uuid NOT NULL,
	"selected_edition_id" uuid,
	"status" text DEFAULT 'want_to_read' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_book_status" CHECK ("v2"."user_books"."status" in ('want_to_read', 'reading', 'paused', 'read', 'dnf'))
);
--> statement-breakpoint
CREATE TABLE "v2"."works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_title_not_blank" CHECK (length(trim("v2"."works"."title")) > 0)
);
--> statement-breakpoint
-- Referenced composite keys must exist before adding their foreign keys.
CREATE UNIQUE INDEX "edition_work_pair" ON "v2"."editions" USING btree ("id","work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_book_work_pair" ON "v2"."user_books" USING btree ("id","work_id");--> statement-breakpoint
ALTER TABLE "v2"."editions" ADD CONSTRAINT "editions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "v2"."works"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."external_mappings" ADD CONSTRAINT "external_mappings_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "v2"."works"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."external_mappings" ADD CONSTRAINT "external_mappings_edition_id_work_id_editions_id_work_id_fk" FOREIGN KEY ("edition_id","work_id") REFERENCES "v2"."editions"("id","work_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."mutation_receipts" ADD CONSTRAINT "mutation_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."progress_entries" ADD CONSTRAINT "progress_entries_reading_session_id_reading_sessions_id_fk" FOREIGN KEY ("reading_session_id") REFERENCES "v2"."reading_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."reading_sessions" ADD CONSTRAINT "reading_sessions_user_book_id_work_id_user_books_id_work_id_fk" FOREIGN KEY ("user_book_id","work_id") REFERENCES "v2"."user_books"("id","work_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."reading_sessions" ADD CONSTRAINT "reading_sessions_edition_id_work_id_editions_id_work_id_fk" FOREIGN KEY ("edition_id","work_id") REFERENCES "v2"."editions"("id","work_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."user_books" ADD CONSTRAINT "user_books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."user_books" ADD CONSTRAINT "user_books_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "v2"."works"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."user_books" ADD CONSTRAINT "user_books_selected_edition_id_work_id_editions_id_work_id_fk" FOREIGN KEY ("selected_edition_id","work_id") REFERENCES "v2"."editions"("id","work_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_identity" ON "v2"."external_mappings" USING btree ("provider","entity_kind","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_mutation_key" ON "v2"."mutation_receipts" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "session_progress_history" ON "v2"."progress_entries" USING btree ("reading_session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_attempt" ON "v2"."reading_sessions" USING btree ("user_book_id") WHERE "v2"."reading_sessions"."state" in ('active', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "user_work_membership" ON "v2"."user_books" USING btree ("user_id","work_id");--> statement-breakpoint
