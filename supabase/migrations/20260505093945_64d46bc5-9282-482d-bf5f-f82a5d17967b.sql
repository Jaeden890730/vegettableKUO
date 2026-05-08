-- 備忘錄表（筆記 + 待辦合併，用 type 區分）
CREATE TABLE public.admin_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'note', -- 'note' or 'todo'
  title TEXT,
  content TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notes" ON public.admin_notes
  FOR SELECT USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert notes" ON public.admin_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update notes" ON public.admin_notes
  FOR UPDATE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete notes" ON public.admin_notes
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_admin_notes_updated_at
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_vegetables_updated_at();