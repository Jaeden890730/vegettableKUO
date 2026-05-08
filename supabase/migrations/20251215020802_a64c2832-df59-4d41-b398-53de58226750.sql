-- 允許任何人讀取客戶列表（管理員透過 Edge Function 驗證）
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;

-- 允許公開讀取（寫入透過 Edge Function 控制）
CREATE POLICY "Anyone can view customers"
ON public.customers
FOR SELECT
USING (true);

-- 同樣處理 orders, settlements, payments 表
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create own orders" ON public.orders;

CREATE POLICY "Anyone can view orders"
ON public.orders
FOR SELECT
USING (true);

CREATE POLICY "Authenticated can create orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can create own order items" ON public.order_items;

CREATE POLICY "Anyone can view order items"
ON public.order_items
FOR SELECT
USING (true);

CREATE POLICY "Authenticated can create order items"
ON public.order_items
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage settlements" ON public.settlements;
DROP POLICY IF EXISTS "Customers can view own settlements" ON public.settlements;

CREATE POLICY "Anyone can view settlements"
ON public.settlements
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage settlement items" ON public.settlement_items;
DROP POLICY IF EXISTS "Customers can view own settlement items" ON public.settlement_items;

CREATE POLICY "Anyone can view settlement items"
ON public.settlement_items
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can view own payments" ON public.payments;

CREATE POLICY "Anyone can view payments"
ON public.payments
FOR SELECT
USING (true);