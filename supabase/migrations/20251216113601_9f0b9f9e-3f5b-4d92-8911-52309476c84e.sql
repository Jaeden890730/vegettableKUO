-- Update the trigger function to change status to 'paid' even if current status is 'draft'
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
  
  -- 判斷新狀態
  IF total_paid >= settlement_total AND settlement_total > 0 THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial_paid';
  ELSE
    new_status := 'confirmed';
  END IF;
  
  -- 更新結帳單 (允許從 draft 直接變成 paid)
  UPDATE public.settlements
  SET paid_amount = total_paid,
      status = new_status
  WHERE id = COALESCE(NEW.settlement_id, OLD.settlement_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;