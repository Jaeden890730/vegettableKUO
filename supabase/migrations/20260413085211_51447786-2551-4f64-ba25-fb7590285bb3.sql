
CREATE TABLE public.tag_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tag_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tag orders"
ON public.tag_orders FOR SELECT
USING (true);

CREATE POLICY "Admins can insert tag orders"
ON public.tag_orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tag orders"
ON public.tag_orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tag orders"
ON public.tag_orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
