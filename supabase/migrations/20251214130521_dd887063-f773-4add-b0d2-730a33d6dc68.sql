-- Create vegetable_prices table for multiple prices per vegetable
CREATE TABLE public.vegetable_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vegetable_id UUID NOT NULL REFERENCES public.vegetables(id) ON DELETE CASCADE,
  unit TEXT NOT NULL DEFAULT '斤',
  price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vegetable_prices ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read prices
CREATE POLICY "Anyone can view vegetable prices"
ON public.vegetable_prices
FOR SELECT
USING (true);

-- Migrate existing price/unit data to the new table
INSERT INTO public.vegetable_prices (vegetable_id, unit, price, sort_order)
SELECT id, unit, price, 0 FROM public.vegetables;