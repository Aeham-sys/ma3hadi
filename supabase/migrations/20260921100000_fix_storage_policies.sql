-- Restore Storage policies omitted from the standalone schema import.
-- App assets are readable by signed-in users and writable by admins only.
DROP POLICY IF EXISTS "assets read" ON storage.objects;
DROP POLICY IF EXISTS "assets admin insert" ON storage.objects;
DROP POLICY IF EXISTS "assets admin update" ON storage.objects;
DROP POLICY IF EXISTS "assets admin delete" ON storage.objects;

CREATE POLICY "assets read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'app-assets');

CREATE POLICY "assets admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

-- Receipt images: users can upload/read only inside their own user-id folder;
-- admins can review and remove receipt images.
DROP POLICY IF EXISTS "receipts own read" ON storage.objects;
DROP POLICY IF EXISTS "receipts admin read" ON storage.objects;
DROP POLICY IF EXISTS "receipts own upload" ON storage.objects;
DROP POLICY IF EXISTS "receipts admin update" ON storage.objects;
DROP POLICY IF EXISTS "receipts admin delete" ON storage.objects;

CREATE POLICY "receipts own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "receipts own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "receipts admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));
