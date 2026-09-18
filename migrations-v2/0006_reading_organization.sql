CREATE TABLE "v2"."reader_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"completion_state" text DEFAULT 'unknown' NOT NULL,
	"source_note" text NOT NULL,
	CONSTRAINT "series_completion_state" CHECK ("v2"."reader_series"."completion_state" in ('unknown', 'open', 'complete')),
	CONSTRAINT "series_curation_text" CHECK (length(trim("v2"."reader_series"."name")) between 1 and 120 and length(trim("v2"."reader_series"."source_note")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "v2"."reader_series_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"series_id" uuid NOT NULL,
	"user_book_id" uuid NOT NULL,
	"sequence_label" text DEFAULT '' NOT NULL,
	"sort_order" integer NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	CONSTRAINT "series_item_order" CHECK ("v2"."reader_series_items"."sort_order" >= 0 and length("v2"."reader_series_items"."sequence_label") <= 40)
);
--> statement-breakpoint
CREATE TABLE "v2"."reading_organization" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "v2"."reading_queue" (
	"user_book_id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "queue_order" CHECK ("v2"."reading_queue"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reader_series_owner" ON "v2"."reader_series" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "reader_series_name" ON "v2"."reader_series" USING btree ("user_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "reader_series_book" ON "v2"."reader_series_items" USING btree ("series_id","user_book_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "one_pinned_next_book" ON "v2"."reading_queue" USING btree ("user_id") WHERE "v2"."reading_queue"."pinned" = true;
--> statement-breakpoint
ALTER TABLE "v2"."reader_series" ADD CONSTRAINT "reader_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2"."reader_series_items" ADD CONSTRAINT "reader_series_items_user_id_series_id_reader_series_user_id_id_fk" FOREIGN KEY ("user_id","series_id") REFERENCES "v2"."reader_series"("user_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2"."reader_series_items" ADD CONSTRAINT "reader_series_items_user_id_user_book_id_user_books_user_id_id_fk" FOREIGN KEY ("user_id","user_book_id") REFERENCES "v2"."user_books"("user_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2"."reading_organization" ADD CONSTRAINT "reading_organization_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2"."reading_queue" ADD CONSTRAINT "reading_queue_user_id_user_book_id_user_books_user_id_id_fk" FOREIGN KEY ("user_id","user_book_id") REFERENCES "v2"."user_books"("user_id","id") ON DELETE cascade ON UPDATE no action;
