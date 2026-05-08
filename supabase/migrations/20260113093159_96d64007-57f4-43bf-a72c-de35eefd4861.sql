-- 新增管理員刪除 app_settings 的 RLS 政策
CREATE POLICY "Admins can delete settings" 
ON public.app_settings 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));