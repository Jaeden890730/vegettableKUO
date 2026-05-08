-- Add unit_price column to order_items table
ALTER TABLE public.order_items 
ADD COLUMN unit_price numeric DEFAULT 0;