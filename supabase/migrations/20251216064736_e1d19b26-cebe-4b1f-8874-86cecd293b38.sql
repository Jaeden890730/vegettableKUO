-- 移除過於寬鬆的公開讀取政策，改為僅限已認證用戶

-- customers 表
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (true);

-- orders 表
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
CREATE POLICY "Authenticated users can view orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (true);

-- order_items 表
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;
CREATE POLICY "Authenticated users can view order items" 
ON public.order_items 
FOR SELECT 
TO authenticated
USING (true);

-- settlements 表
DROP POLICY IF EXISTS "Anyone can view settlements" ON public.settlements;
CREATE POLICY "Authenticated users can view settlements" 
ON public.settlements 
FOR SELECT 
TO authenticated
USING (true);

-- settlement_items 表
DROP POLICY IF EXISTS "Anyone can view settlement items" ON public.settlement_items;
CREATE POLICY "Authenticated users can view settlement items" 
ON public.settlement_items 
FOR SELECT 
TO authenticated
USING (true);

-- payments 表
DROP POLICY IF EXISTS "Anyone can view payments" ON public.payments;
CREATE POLICY "Authenticated users can view payments" 
ON public.payments 
FOR SELECT 
TO authenticated
USING (true);