-- 鎖定 vegetables 表，只允許公開讀取，移除所有公開寫入權限

-- 移除允許任何人寫入的政策
DROP POLICY IF EXISTS "Anyone can insert vegetables" ON public.vegetables;
DROP POLICY IF EXISTS "Anyone can update vegetables" ON public.vegetables;
DROP POLICY IF EXISTS "Anyone can delete vegetables" ON public.vegetables;

-- 確保 SELECT 政策存在（保持原本的讀取邏輯）
-- 非登入用戶只能看到非隱藏的品項
DROP POLICY IF EXISTS "Anyone can view non-hidden vegetables" ON public.vegetables;
CREATE POLICY "Anyone can view non-hidden vegetables"
ON public.vegetables
FOR SELECT
TO public
USING (status <> 'hidden');

-- 注意：現在所有寫入操作都必須透過 Edge Function（使用 service role key）