-- 更新收款狀態判斷觸發器，使用四捨五入比對避免小數點誤差
CREATE OR REPLACE FUNCTION public.update_settlement_paid_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_paid NUMERIC;
  settlement_total NUMERIC;
  new_status TEXT;
BEGIN
  -- 計算該結帳單的總收款金額
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.payments
  WHERE settlement_id = COALESCE(NEW.settlement_id, OLD.settlement_id);
  
  -- 取得結帳單總金額
  SELECT total_amount INTO settlement_total
  FROM public.settlements
  WHERE id = COALESCE(NEW.settlement_id, OLD.settlement_id);
  
  -- 判斷新狀態 - 使用四捨五入到整數來比對，避免小數點誤差
  IF ROUND(total_paid) >= ROUND(settlement_total) AND settlement_total > 0 THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial_paid';
  ELSE
    new_status := 'confirmed';
  END IF;
  
  -- 更新結帳單
  UPDATE public.settlements
  SET paid_amount = total_paid,
      status = new_status
  WHERE id = COALESCE(NEW.settlement_id, OLD.settlement_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 修正現有結帳單狀態：將已收金額等於或接近總金額的結帳單標記為 paid
UPDATE public.settlements
SET status = 'paid'
WHERE ROUND(paid_amount) >= ROUND(total_amount) 
  AND total_amount > 0 
  AND status != 'paid';