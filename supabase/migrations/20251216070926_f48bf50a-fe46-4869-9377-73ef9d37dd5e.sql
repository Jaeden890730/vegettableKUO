-- Drop existing overly permissive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can view settlements" ON public.settlements;
DROP POLICY IF EXISTS "Authenticated users can view settlement items" ON public.settlement_items;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

-- Customers table: Admin sees all, Customer sees only their own record
CREATE POLICY "Users can view appropriate customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR id = public.get_customer_id_for_user(auth.uid())
);

-- Orders table: Admin sees all, Customer sees only their orders
CREATE POLICY "Users can view appropriate orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR customer_id = public.get_customer_id_for_user(auth.uid())
);

-- Order items table: Admin sees all, Customer sees items from their orders
CREATE POLICY "Users can view appropriate order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_id = public.get_customer_id_for_user(auth.uid())
  )
);

-- Settlements table: Admin sees all, Customer sees only their settlements
CREATE POLICY "Users can view appropriate settlements"
ON public.settlements
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR customer_id = public.get_customer_id_for_user(auth.uid())
);

-- Settlement items table: Admin sees all, Customer sees items from their settlements
CREATE POLICY "Users can view appropriate settlement items"
ON public.settlement_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR settlement_id IN (
    SELECT id FROM public.settlements 
    WHERE customer_id = public.get_customer_id_for_user(auth.uid())
  )
);

-- Payments table: Admin sees all, Customer sees payments from their settlements
CREATE POLICY "Users can view appropriate payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR settlement_id IN (
    SELECT id FROM public.settlements 
    WHERE customer_id = public.get_customer_id_for_user(auth.uid())
  )
);