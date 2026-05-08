-- Add packs column to order_items table for tracking package count
ALTER TABLE public.order_items
ADD COLUMN packs integer NOT NULL DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN public.order_items.packs IS 'Number of packages/portions for this item (e.g., 5斤 × 3包 means packs=3)';