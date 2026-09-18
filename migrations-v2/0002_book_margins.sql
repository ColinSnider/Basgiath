CREATE TABLE "v2"."margins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_book_id" uuid NOT NULL,
	"body" text NOT NULL,
	"locator" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "margin_body_length" CHECK (length(trim("v2"."margins"."body")) between 1 and 10000),
	CONSTRAINT "margin_locator_length" CHECK ("v2"."margins"."locator" is null or length("v2"."margins"."locator") <= 120)
);
--> statement-breakpoint
ALTER TABLE "v2"."margins" ADD CONSTRAINT "margins_user_book_id_user_books_id_fk" FOREIGN KEY ("user_book_id") REFERENCES "v2"."user_books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "margin_book_history" ON "v2"."margins" USING btree ("user_book_id","created_at");