import { useState } from 'react';
import { useSettlements } from '@/hooks/useSettlements';
import { useCustomers } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Edit, Trash2, AlertCircle } from 'lucide-react';
import { Payment, PaymentMethod } from '@/types/order';

export default function AdminPayments() {
  const { settlements, updatePayment, deletePayment } = useSettlements({ isAdmin: true });
  const { customers } = useCustomers();

  // Filters
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Edit dialog
  const [editingPayment, setEditingPayment] = useState<(Payment & { settlement_number: string; customer_name: string; settlement_id: string }) | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('cash');

  // Flatten all payments with settlement info
  const allPayments = settlements.flatMap(settlement => 
    (settlement.payments || []).map(payment => ({
      ...payment,
      settlement_id: settlement.id,
      settlement_number: settlement.settlement_number,
      customer_id: settlement.customer_id,
      customer_name: settlement.customer?.name || '',
    }))
  ).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

  // Apply filters
  const filteredPayments = allPayments.filter(payment => {
    if (filterCustomer !== 'all' && payment.customer_id !== filterCustomer) return false;
    if (filterDateFrom && payment.payment_date < filterDateFrom) return false;
    if (filterDateTo && payment.payment_date > filterDateTo) return false;
    return true;
  });

  // Outstanding settlements (not fully paid)
  const outstandingSettlements = settlements.filter(s => 
    s.status !== 'paid' && Number(s.total_amount) > Number(s.paid_amount)
  );

  const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOutstanding = outstandingSettlements.reduce((sum, s) => 
    sum + (Number(s.total_amount) - Number(s.paid_amount)), 0
  );

  const handleEdit = (payment: typeof allPayments[0]) => {
    setEditingPayment(payment);
    setEditAmount(String(payment.amount));
    setEditDate(payment.payment_date);
    setEditMethod(payment.payment_method as PaymentMethod);
  };

  const handleSaveEdit = async () => {
    if (!editingPayment) return;
    const { error } = await updatePayment(editingPayment.id, {
      amount: Number(editAmount),
      payment_date: editDate,
      payment_method: editMethod,
    });
    if (error) {
      toast.error('更新失敗');
    } else {
      toast.success('已更新收款');
      setEditingPayment(null);
    }
  };

  const handleDelete = async (payment: typeof allPayments[0]) => {
    if (!confirm(`確定要刪除這筆 $${payment.amount} 的收款紀錄嗎？`)) return;
    const { error } = await deletePayment(payment.id);
    if (error) {
      toast.error('刪除失敗');
    } else {
      toast.success('已刪除收款');
    }
  };

  const clearFilters = () => {
    setFilterCustomer('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">收款管理</h2>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-sm text-muted-foreground">累計收款</div>
            <div className="text-xl font-bold text-green-600">${totalPaid.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">總未收</div>
            <div className="text-xl font-bold text-destructive">${totalOutstanding.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm text-muted-foreground">客戶</label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="全部客戶" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部客戶</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <label className="text-sm text-muted-foreground">起始日期</label>
              <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="min-w-[130px]">
              <label className="text-sm text-muted-foreground">結束日期</label>
              <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>清除篩選</Button>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Settlements */}
      {outstandingSettlements.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              未收款結帳單 ({outstandingSettlements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outstandingSettlements.map(settlement => (
              <div key={settlement.id} className="flex items-center justify-between text-sm bg-background rounded p-2">
                <div>
                  <span className="font-medium">{settlement.customer?.name}</span>
                  <span className="text-muted-foreground ml-2">{settlement.settlement_number}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">
                    已收 ${Number(settlement.paid_amount).toLocaleString()} / ${Number(settlement.total_amount).toLocaleString()}
                  </span>
                  <span className="ml-2 font-bold text-destructive">
                    餘 ${(Number(settlement.total_amount) - Number(settlement.paid_amount)).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payments List */}
      <div className="space-y-2">
        <h3 className="font-medium text-muted-foreground">收款紀錄 ({filteredPayments.length})</h3>
        {filteredPayments.map(payment => (
          <Card key={payment.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{payment.customer_name}</div>
                  <div className="text-sm text-muted-foreground">
                    結帳單 {payment.settlement_number}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">${Number(payment.amount).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {payment.payment_date} · {
                        payment.payment_method === 'cash' ? '現金' :
                        payment.payment_method === 'transfer' ? '轉帳' :
                        payment.payment_method === 'check' ? '支票' : '其他'
                      }
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(payment)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(payment)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredPayments.length === 0 && (
          <p className="text-center text-muted-foreground py-8">尚無收款紀錄</p>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={() => setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯收款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">客戶</label>
              <div className="font-medium">{editingPayment?.customer_name}</div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">結帳單</label>
              <div className="font-medium">{editingPayment?.settlement_number}</div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">收款金額</label>
              <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">收款日期</label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">付款方式</label>
              <Select value={editMethod} onValueChange={(v: PaymentMethod) => setEditMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="transfer">轉帳</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}