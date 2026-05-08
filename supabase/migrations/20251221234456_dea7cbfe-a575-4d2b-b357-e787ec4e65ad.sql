-- 修正所有結帳單項目的小計為四捨五入值
UPDATE public.settlement_items
SET subtotal = ROUND(settlement_quantity * settlement_unit_price);

-- 重新計算所有結帳單的總金額（使用已四捨五入的小計加總）
UPDATE public.settlements s
SET total_amount = (
  SELECT COALESCE(SUM(subtotal), 0)
  FROM public.settlement_items si
  WHERE si.settlement_id = s.id
);

-- 修正結帳單狀態
UPDATE public.settlements
SET status = CASE 
  WHEN ROUND(paid_amount) >= total_amount AND total_amount > 0 THEN 'paid'
  WHEN paid_amount > 0 THEN 'partial_paid'
  ELSE status
END
WHERE total_amount > 0;