ALTER TABLE v2.reading_sessions ADD COLUMN timer_started_at timestamptz;
--> statement-breakpoint
ALTER TABLE v2.reading_sessions ADD COLUMN reading_seconds integer NOT NULL DEFAULT 0 CHECK (reading_seconds >= 0);
--> statement-breakpoint
ALTER TABLE v2.reading_sessions ADD COLUMN timed_reads jsonb NOT NULL DEFAULT '[]'::jsonb;
