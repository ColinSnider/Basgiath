CREATE TABLE "v2"."ratings" (
	"user_book_id" uuid PRIMARY KEY NOT NULL,
	"half_stars" integer NOT NULL,
	CONSTRAINT "rating_half_stars" CHECK ("v2"."ratings"."half_stars" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "v2"."shelf_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"user_book_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "v2"."shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelf_name_not_blank" CHECK (length(trim("v2"."shelves"."name")) > 0)
);
--> statement-breakpoint
-- Referenced composite keys must exist before their foreign keys.
CREATE UNIQUE INDEX "shelf_user_pair" ON "v2"."shelves" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_book_owner_pair" ON "v2"."user_books" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "v2"."ratings" ADD CONSTRAINT "ratings_user_book_id_user_books_id_fk" FOREIGN KEY ("user_book_id") REFERENCES "v2"."user_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."shelf_items" ADD CONSTRAINT "shelf_items_shelf_id_user_id_shelves_id_user_id_fk" FOREIGN KEY ("shelf_id","user_id") REFERENCES "v2"."shelves"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."shelf_items" ADD CONSTRAINT "shelf_items_user_book_id_user_id_user_books_id_user_id_fk" FOREIGN KEY ("user_book_id","user_id") REFERENCES "v2"."user_books"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2"."shelves" ADD CONSTRAINT "shelves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shelf_item_membership" ON "v2"."shelf_items" USING btree ("shelf_id","user_book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shelf_user_name" ON "v2"."shelves" USING btree ("user_id","name");
