-- Create holiday_dates table for storing holiday information
CREATE TABLE public.holiday_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.holiday_dates ENABLE ROW LEVEL SECURITY;

-- Anyone can view holidays (public info)
CREATE POLICY "Anyone can view holidays" 
ON public.holiday_dates 
FOR SELECT 
USING (true);

-- Only admins can insert holidays
CREATE POLICY "Admins can insert holidays" 
ON public.holiday_dates 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update holidays
CREATE POLICY "Admins can update holidays" 
ON public.holiday_dates 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete holidays
CREATE POLICY "Admins can delete holidays" 
ON public.holiday_dates 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));