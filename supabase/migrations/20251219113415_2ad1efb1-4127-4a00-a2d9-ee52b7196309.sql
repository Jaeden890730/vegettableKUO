-- Add merchant_note column to orders table for admin notes visible to customers
ALTER TABLE public.orders 
ADD COLUMN merchant_note text DEFAULT NULL;