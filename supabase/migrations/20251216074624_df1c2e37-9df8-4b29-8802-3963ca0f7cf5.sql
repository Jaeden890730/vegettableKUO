-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can view accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Only admins can insert accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Only admins can update accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Only admins can delete accounting entries" ON public.accounting_entries;

-- Create permissive policies for admins
CREATE POLICY "Admins can view accounting entries" 
ON public.accounting_entries 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert accounting entries" 
ON public.accounting_entries 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update accounting entries" 
ON public.accounting_entries 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete accounting entries" 
ON public.accounting_entries 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));