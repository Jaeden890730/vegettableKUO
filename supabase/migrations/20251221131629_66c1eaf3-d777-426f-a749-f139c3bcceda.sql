-- 1. 修復 vegetables 表的衝突政策 - 移除過於寬鬆的政策
DROP POLICY IF EXISTS "Authenticated users can view all vegetables" ON public.vegetables;

-- 2. 更新 customers 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Users can view appropriate customers" ON public.customers;
CREATE POLICY "Users can view appropriate customers" ON public.customers
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (id = get_customer_id_for_user(auth.uid()))
  )
);

-- 3. 更新 orders 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Users can view appropriate orders" ON public.orders;
CREATE POLICY "Users can view appropriate orders" ON public.orders
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (customer_id = get_customer_id_for_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can create appropriate orders" ON public.orders;
CREATE POLICY "Users can create appropriate orders" ON public.orders
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (customer_id = get_customer_id_for_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can update appropriate orders" ON public.orders;
CREATE POLICY "Users can update appropriate orders" ON public.orders
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (customer_id = get_customer_id_for_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can delete appropriate orders" ON public.orders;
CREATE POLICY "Users can delete appropriate orders" ON public.orders
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (customer_id = get_customer_id_for_user(auth.uid()))
  )
);

-- 4. 更新 order_items 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Users can view appropriate order items" ON public.order_items;
CREATE POLICY "Users can view appropriate order items" ON public.order_items
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (order_id IN (SELECT id FROM orders WHERE customer_id = get_customer_id_for_user(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can create appropriate order items" ON public.order_items;
CREATE POLICY "Users can create appropriate order items" ON public.order_items
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (order_id IN (SELECT id FROM orders WHERE customer_id = get_customer_id_for_user(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can update appropriate order items" ON public.order_items;
CREATE POLICY "Users can update appropriate order items" ON public.order_items
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (order_id IN (SELECT id FROM orders WHERE customer_id = get_customer_id_for_user(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can delete appropriate order items" ON public.order_items;
CREATE POLICY "Users can delete appropriate order items" ON public.order_items
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (order_id IN (SELECT id FROM orders WHERE customer_id = get_customer_id_for_user(auth.uid())))
  )
);

-- 5. 更新 settlements 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Users can view appropriate settlements" ON public.settlements;
CREATE POLICY "Users can view appropriate settlements" ON public.settlements
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (customer_id = get_customer_id_for_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Only admins can insert settlements" ON public.settlements;
CREATE POLICY "Only admins can insert settlements" ON public.settlements
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admins can update settlements" ON public.settlements;
CREATE POLICY "Only admins can update settlements" ON public.settlements
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admins can delete settlements" ON public.settlements;
CREATE POLICY "Only admins can delete settlements" ON public.settlements
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- 6. 更新 settlement_items 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Users can view appropriate settlement items" ON public.settlement_items;
CREATE POLICY "Users can view appropriate settlement items" ON public.settlement_items
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (settlement_id IN (SELECT id FROM settlements WHERE customer_id = get_customer_id_for_user(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Only admins can insert settlement items" ON public.settlement_items;
CREATE POLICY "Only admins can insert settlement items" ON public.settlement_items
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admins can update settlement items" ON public.settlement_items;
CREATE POLICY "Only admins can update settlement items" ON public.settlement_items
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admins can delete settlement items" ON public.settlement_items;
CREATE POLICY "Only admins can delete settlement items" ON public.settlement_items
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- 7. 更新 payments 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Users can view appropriate payments" ON public.payments;
CREATE POLICY "Users can view appropriate payments" ON public.payments
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (settlement_id IN (SELECT id FROM settlements WHERE customer_id = get_customer_id_for_user(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Only admins can insert payments" ON public.payments;
CREATE POLICY "Only admins can insert payments" ON public.payments
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admins can update payments" ON public.payments;
CREATE POLICY "Only admins can update payments" ON public.payments
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admins can delete payments" ON public.payments;
CREATE POLICY "Only admins can delete payments" ON public.payments
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- 8. 更新 accounting_entries 表政策 - 明確阻擋匿名存取
DROP POLICY IF EXISTS "Admins can view accounting entries" ON public.accounting_entries;
CREATE POLICY "Admins can view accounting entries" ON public.accounting_entries
FOR SELECT USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can insert accounting entries" ON public.accounting_entries;
CREATE POLICY "Admins can insert accounting entries" ON public.accounting_entries
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can update accounting entries" ON public.accounting_entries;
CREATE POLICY "Admins can update accounting entries" ON public.accounting_entries
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can delete accounting entries" ON public.accounting_entries;
CREATE POLICY "Admins can delete accounting entries" ON public.accounting_entries
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);