-- Create trigger on payments table to automatically update settlement paid_amount and status
CREATE OR REPLACE TRIGGER update_settlement_on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_settlement_paid_amount();