
-- Create independent retail vegetables table
CREATE TABLE public.retail_vegetables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '斤',
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_stock',
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_wholesale BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create independent retail vegetable prices table
CREATE TABLE public.retail_vegetable_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vegetable_id UUID NOT NULL REFERENCES public.retail_vegetables(id) ON DELETE CASCADE,
  unit TEXT NOT NULL DEFAULT '斤',
  price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retail_vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_vegetable_prices ENABLE ROW LEVEL SECURITY;

-- Anyone can view non-hidden retail vegetables
CREATE POLICY "Anyone can view non-hidden retail vegetables"
  ON public.retail_vegetables FOR SELECT
  USING (status <> 'hidden');

-- Anyone can view retail vegetable prices
CREATE POLICY "Anyone can view retail vegetable prices"
  ON public.retail_vegetable_prices FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_retail_vegetables_updated_at
  BEFORE UPDATE ON public.retail_vegetables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vegetables_updated_at();
