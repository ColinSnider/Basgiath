CREATE TABLE v2.goal_details (
  goal_id text PRIMARY KEY REFERENCES public.goals(id) ON DELETE CASCADE,
  details jsonb NOT NULL DEFAULT '{"title":"","unit":"","entries":[]}'::jsonb,
  CONSTRAINT goal_details_object CHECK (jsonb_typeof(details) = 'object')
);
