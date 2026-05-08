
DROP POLICY "Anyone can view non-hidden vegetables" ON public.vegetables;

CREATE POLICY "View vegetables based on role"
ON public.vegetables FOR SELECT
USING (
  status <> 'hidden' OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);
