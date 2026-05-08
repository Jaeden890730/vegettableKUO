-- Create vegetables table
CREATE TABLE public.vegetables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '斤',
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'out_of_stock', 'hidden')),
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_wholesale BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vegetables ENABLE ROW LEVEL SECURITY;

-- Public read policy (exclude hidden items)
CREATE POLICY "Anyone can view non-hidden vegetables"
ON public.vegetables
FOR SELECT
USING (status != 'hidden');

-- Authenticated users can manage all vegetables
CREATE POLICY "Authenticated users can insert vegetables"
ON public.vegetables
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update vegetables"
ON public.vegetables
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete vegetables"
ON public.vegetables
FOR DELETE
TO authenticated
USING (true);

-- Authenticated users can also view hidden items
CREATE POLICY "Authenticated users can view all vegetables"
ON public.vegetables
FOR SELECT
TO authenticated
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_vegetables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_vegetables_updated_at
BEFORE UPDATE ON public.vegetables
FOR EACH ROW
EXECUTE FUNCTION public.update_vegetables_updated_at();

-- Insert default vegetables data
INSERT INTO public.vegetables (name, unit, price, status, note, sort_order, is_wholesale) VALUES
('高麗菜', '斤', 25, 'in_stock', '品質佳', 1, false),
('青江菜', '斤', 30, 'in_stock', NULL, 2, false),
('空心菜', '斤', 35, 'in_stock', NULL, 3, false),
('地瓜葉', '斤', 28, 'in_stock', NULL, 4, true),
('小白菜', '斤', 32, 'in_stock', NULL, 5, false),
('菠菜', '斤', 40, 'in_stock', NULL, 6, false),
('芥蘭菜', '斤', 45, 'in_stock', NULL, 7, true),
('大陸妹', '斤', 28, 'out_of_stock', NULL, 8, false),
('紅蘿蔔', '斤', 20, 'in_stock', '限量', 9, false),
('白蘿蔔', '斤', 18, 'in_stock', NULL, 10, true);