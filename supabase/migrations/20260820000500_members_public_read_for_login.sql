-- Allow public (unauthenticated) read of member slots and setup flag
-- so the card login page can resolve names/colors/password_set before sign-in.
drop policy "members select all" on public.members;
create policy "members select all" on public.members for select
  using (true);

drop policy "app_settings select all" on public.app_settings;
create policy "app_settings select all" on public.app_settings for select
  using (true);
