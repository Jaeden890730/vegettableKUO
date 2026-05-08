-- Enable orders UPDATE and DELETE
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);

CREATE POLICY "Authenticated can update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete orders" ON public.orders FOR DELETE USING (true);

-- Enable order_items UPDATE and DELETE
CREATE POLICY "Authenticated can update order items" ON public.order_items FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete order items" ON public.order_items FOR DELETE USING (true);

-- Enable settlements INSERT/UPDATE/DELETE
CREATE POLICY "Authenticated can insert settlements" ON public.settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update settlements" ON public.settlements FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete settlements" ON public.settlements FOR DELETE USING (true);

-- Enable settlement_items INSERT/UPDATE/DELETE  
CREATE POLICY "Authenticated can insert settlement items" ON public.settlement_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update settlement items" ON public.settlement_items FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete settlement items" ON public.settlement_items FOR DELETE USING (true);

-- Enable payments INSERT/UPDATE/DELETE
CREATE POLICY "Authenticated can insert payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update payments" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete payments" ON public.payments FOR DELETE USING (true);