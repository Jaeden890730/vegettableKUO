-- 1. 建立角色枚舉
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

-- 2. 建立用戶角色表
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 用戶可以查看自己的角色
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. 建立檢查角色的安全函數
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. 建立客戶表
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  contact_person TEXT,
  settlement_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (settlement_cycle IN ('weekly', 'monthly')),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 管理員可以查看和管理所有客戶
CREATE POLICY "Admins can manage customers"
ON public.customers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 客戶可以查看自己的資料
CREATE POLICY "Customers can view own data"
ON public.customers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. 建立訂單主表
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 管理員可以管理所有訂單
CREATE POLICY "Admins can manage orders"
ON public.orders FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 客戶可以查看和建立自己的訂單
CREATE POLICY "Customers can view own orders"
ON public.orders FOR SELECT
TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Customers can create own orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- 6. 建立訂單品項表
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  vegetable_id UUID REFERENCES public.vegetables(id) ON DELETE SET NULL,
  custom_item_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '斤',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 管理員可以管理所有訂單品項
CREATE POLICY "Admins can manage order items"
ON public.order_items FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 客戶可以查看和建立自己的訂單品項
CREATE POLICY "Customers can view own order items"
ON public.order_items FOR SELECT
TO authenticated
USING (order_id IN (
  SELECT o.id FROM public.orders o 
  JOIN public.customers c ON o.customer_id = c.id 
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Customers can create own order items"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (order_id IN (
  SELECT o.id FROM public.orders o 
  JOIN public.customers c ON o.customer_id = c.id 
  WHERE c.user_id = auth.uid()
));

-- 7. 建立結帳單主表
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'partial_paid', 'paid')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- 管理員可以管理所有結帳單
CREATE POLICY "Admins can manage settlements"
ON public.settlements FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 客戶可以查看自己的結帳單
CREATE POLICY "Customers can view own settlements"
ON public.settlements FOR SELECT
TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- 8. 建立結帳品項明細表
CREATE TABLE public.settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES public.settlements(id) ON DELETE CASCADE NOT NULL,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  settlement_quantity NUMERIC NOT NULL DEFAULT 0,
  settlement_unit TEXT NOT NULL DEFAULT '斤',
  settlement_unit_price NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_items ENABLE ROW LEVEL SECURITY;

-- 管理員可以管理所有結帳品項
CREATE POLICY "Admins can manage settlement items"
ON public.settlement_items FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 客戶可以查看自己的結帳品項
CREATE POLICY "Customers can view own settlement items"
ON public.settlement_items FOR SELECT
TO authenticated
USING (settlement_id IN (
  SELECT s.id FROM public.settlements s 
  JOIN public.customers c ON s.customer_id = c.id 
  WHERE c.user_id = auth.uid()
));

-- 9. 建立收款紀錄表
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES public.settlements(id) ON DELETE CASCADE NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 管理員可以管理所有收款紀錄
CREATE POLICY "Admins can manage payments"
ON public.payments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 客戶可以查看自己的收款紀錄
CREATE POLICY "Customers can view own payments"
ON public.payments FOR SELECT
TO authenticated
USING (settlement_id IN (
  SELECT s.id FROM public.settlements s 
  JOIN public.customers c ON s.customer_id = c.id 
  WHERE c.user_id = auth.uid()
));

-- 10. 建立訂單編號生成函數
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 10) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.orders
  WHERE order_number LIKE 'O' || today_str || '%';
  new_number := 'O' || today_str || LPAD(seq_num::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- 11. 建立結帳單編號生成函數
CREATE OR REPLACE FUNCTION public.generate_settlement_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SUBSTRING(settlement_number FROM 10) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.settlements
  WHERE settlement_number LIKE 'S' || today_str || '%';
  new_number := 'S' || today_str || LPAD(seq_num::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- 12. 建立更新 updated_at 的觸發器
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_vegetables_updated_at();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_vegetables_updated_at();

CREATE TRIGGER update_settlements_updated_at
BEFORE UPDATE ON public.settlements
FOR EACH ROW
EXECUTE FUNCTION public.update_vegetables_updated_at();

-- 13. 建立收款後自動更新結帳單狀態的函數和觸發器
CREATE OR REPLACE FUNCTION public.update_settlement_paid_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF total_paid >= settlement_total THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial_paid';
  ELSE
    new_status := 'confirmed';
  END IF;
  
  -- 更新結帳單
  UPDATE public.settlements
  SET paid_amount = total_paid,
      status = CASE 
        WHEN status = 'draft' THEN status 
        ELSE new_status 
      END
  WHERE id = COALESCE(NEW.settlement_id, OLD.settlement_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_settlement_on_payment
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_settlement_paid_amount();

-- 14. 建立取得用戶客戶ID的函數
CREATE OR REPLACE FUNCTION public.get_customer_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE user_id = _user_id LIMIT 1;
$$;