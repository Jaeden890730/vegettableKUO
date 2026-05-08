-- Add order_date column to settlement_items for tracking when the order was placed
ALTER TABLE public.settlement_items 
ADD COLUMN order_date date;