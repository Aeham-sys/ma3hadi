DROP POLICY IF EXISTS "read app files" ON storage.objects;
DROP POLICY IF EXISTS "update app files" ON storage.objects;
DROP POLICY IF EXISTS "upload app files" ON storage.objects;

-- Receipts: each owner only inside their own uid folder
CREATE POLICY "receipts own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts admin read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "receipts own upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts admin update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "receipts admin delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

-- App assets (ShamCash QR): readable by all signed-in users, writable by admin only
CREATE POLICY "assets read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app-assets');

CREATE POLICY "assets admin insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "assets admin update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "assets admin delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));