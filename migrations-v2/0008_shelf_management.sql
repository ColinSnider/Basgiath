ALTER TABLE v2.shelves ADD COLUMN description text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE v2.shelves ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE v2.shelf_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
--> statement-breakpoint
WITH ordered AS (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1 AS position FROM v2.shelves) UPDATE v2.shelves SET sort_order = ordered.position FROM ordered WHERE shelves.id = ordered.id;
--> statement-breakpoint
WITH ordered AS (SELECT id, row_number() OVER (PARTITION BY shelf_id ORDER BY added_at, id) - 1 AS position FROM v2.shelf_items) UPDATE v2.shelf_items SET sort_order = ordered.position FROM ordered WHERE shelf_items.id = ordered.id;
