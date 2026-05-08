-- 放寬 vegetables 表的寫入權限，並加入更新時間觸發器

-- 1) 調整 RLS，讓目前使用的匿名訪客角色也能進行新增/修改/刪除
DROP POLICY IF EXISTS "Authenticated users can insert vegetables" ON public.vegetables;
DROP POLICY IF EXISTS "Authenticated users can update vegetables" ON public.vegetables;
DROP POLICY IF EXISTS "Authenticated users can delete vegetables" ON public.vegetables;

CREATE POLICY "Anyone can insert vegetables"
ON public.vegetables
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update vegetables"
ON public.vegetables
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete vegetables"
ON public.vegetables
FOR DELETE
TO public
USING (true);

-- 保留原本的查看政策：
--   Anyone can view non-hidden vegetables
--   Authenticated users can view all vegetables
-- 不做修改

-- 2) 建立 updated_at 觸發器：每次更新該品項時自動寫入現在時間
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_vegetables_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_vegetables_updated_at_trigger
    BEFORE UPDATE ON public.vegetables
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vegetables_updated_at();
  END IF;
END;
$$;