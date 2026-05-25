-- Allow upsert on trajectory by (user_id, month)
ALTER TABLE public.trajectory
  ADD CONSTRAINT trajectory_user_month_key UNIQUE (user_id, month);
