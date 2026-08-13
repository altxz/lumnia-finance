-- Lock down avatar reads to the owner
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Users can view own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Restrict SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.prevent_plan_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_starting_balance(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_starting_balance(uuid, date) TO service_role;