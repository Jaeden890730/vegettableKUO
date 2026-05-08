-- Add unlock flags to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS can_view_all_dates boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_item_stats_detail boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.can_view_all_dates IS '是否解鎖日期區間選擇功能';
COMMENT ON COLUMN public.customers.can_view_item_stats_detail IS '是否解鎖品項統計詳細數量與金額';