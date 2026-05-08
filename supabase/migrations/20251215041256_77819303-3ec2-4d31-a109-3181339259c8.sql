-- Create trigger for payments table to auto-update settlement status
CREATE OR REPLACE TRIGGER update_settlement_on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_settlement_paid_amount();