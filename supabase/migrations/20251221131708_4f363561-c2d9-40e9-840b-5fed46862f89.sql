-- 1. 為 customers 表新增 INSERT, UPDATE, DELETE 政策（只允許 admin）
CREATE POLICY "Only admins can insert customers" ON public.customers
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can update customers" ON public.customers
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can delete customers" ON public.customers
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- 2. 為 user_roles 表新增 INSERT, UPDATE, DELETE 政策（只允許 admin）
CREATE POLICY "Only admins can insert user roles" ON public.user_roles
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can update user roles" ON public.user_roles
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can delete user roles" ON public.user_roles
FOR DELETE USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);