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
