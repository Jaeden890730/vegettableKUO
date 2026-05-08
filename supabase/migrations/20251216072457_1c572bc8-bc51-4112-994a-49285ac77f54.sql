-- =============================================
-- 修正 orders 表的寫入權限
-- =============================================

-- 刪除現有過於寬鬆的政策
DROP POLICY IF EXISTS "Authenticated can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can delete orders" ON public.orders;

-- INSERT: 客戶只能為自己創建訂單，管理員可為任何客戶創建
CREATE POLICY "Users can create appropriate orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR customer_id = public.get_customer_id_for_user(auth.uid())
);

-- UPDATE: 客戶只能更新自己的訂單，管理員可更新全部
CREATE POLICY "Users can update appropriate orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR customer_id = public.get_customer_id_for_user(auth.uid())
);

-- DELETE: 客戶只能刪除自己的訂單，管理員可刪除全部
CREATE POLICY "Users can delete appropriate orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR customer_id = public.get_customer_id_for_user(auth.uid())
);

-- =============================================
-- 修正 order_items 表的寫入權限
-- =============================================

DROP POLICY IF EXISTS "Authenticated can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated can delete order items" ON public.order_items;

-- INSERT: 客戶只能為自己的訂單新增項目
CREATE POLICY "Users can create appropriate order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_id = public.get_customer_id_for_user(auth.uid())
  )
);

-- UPDATE: 客戶只能更新自己訂單的項目
CREATE POLICY "Users can update appropriate order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_id = public.get_customer_id_for_user(auth.uid())
  )
);

-- DELETE: 客戶只能刪除自己訂單的項目
CREATE POLICY "Users can delete appropriate order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_id = public.get_customer_id_for_user(auth.uid())
  )
);

-- =============================================
-- 修正 settlements 表的寫入權限 (僅管理員)
-- =============================================

DROP POLICY IF EXISTS "Authenticated can insert settlements" ON public.settlements;
DROP POLICY IF EXISTS "Authenticated can update settlements" ON public.settlements;
DROP POLICY IF EXISTS "Authenticated can delete settlements" ON public.settlements;

CREATE POLICY "Only admins can insert settlements"
ON public.settlements
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update settlements"
ON public.settlements
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete settlements"
ON public.settlements
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 修正 settlement_items 表的寫入權限 (僅管理員)
-- =============================================

DROP POLICY IF EXISTS "Authenticated can insert settlement items" ON public.settlement_items;
DROP POLICY IF EXISTS "Authenticated can update settlement items" ON public.settlement_items;
DROP POLICY IF EXISTS "Authenticated can delete settlement items" ON public.settlement_items;

CREATE POLICY "Only admins can insert settlement items"
ON public.settlement_items
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update settlement items"
ON public.settlement_items
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete settlement items"
ON public.settlement_items
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 修正 payments 表的寫入權限 (僅管理員)
-- =============================================

DROP POLICY IF EXISTS "Authenticated can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can delete payments" ON public.payments;

CREATE POLICY "Only admins can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));