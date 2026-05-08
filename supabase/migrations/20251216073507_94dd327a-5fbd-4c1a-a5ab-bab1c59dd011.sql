-- 建立帳目類型 enum
CREATE TYPE public.accounting_entry_type AS ENUM ('income', 'expense', 'purchase');

-- 建立帳目記錄表
CREATE TABLE public.accounting_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type accounting_entry_type NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

-- 僅管理員可查看帳目
CREATE POLICY "Only admins can view accounting entries"
ON public.accounting_entries
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 僅管理員可新增帳目
CREATE POLICY "Only admins can insert accounting entries"
ON public.accounting_entries
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 僅管理員可更新帳目
CREATE POLICY "Only admins can update accounting entries"
ON public.accounting_entries
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 僅管理員可刪除帳目
CREATE POLICY "Only admins can delete accounting entries"
ON public.accounting_entries
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 建立索引加速查詢
CREATE INDEX idx_accounting_entries_date ON public.accounting_entries(entry_date);
CREATE INDEX idx_accounting_entries_type ON public.accounting_entries(entry_type);
CREATE INDEX idx_accounting_entries_category ON public.accounting_entries(category);