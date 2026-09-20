
CREATE POLICY "read app files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('receipts','app-assets'));
CREATE POLICY "upload app files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('receipts','app-assets'));
CREATE POLICY "update app files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('receipts','app-assets')) WITH CHECK (bucket_id IN ('receipts','app-assets'));
