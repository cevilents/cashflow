create policy "receipts buckets visible" on storage.buckets
  for select
  to anon, authenticated
  using (id = 'receipts');