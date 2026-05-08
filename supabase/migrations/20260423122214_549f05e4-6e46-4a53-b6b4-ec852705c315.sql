CREATE TABLE public.supplier_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view supplier orders"
ON public.supplier_orders FOR SELECT
USING (true);

CREATE POLICY "Admins can insert supplier orders"
ON public.supplier_orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update supplier orders"
ON public.supplier_orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete supplier orders"
ON public.supplier_orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));