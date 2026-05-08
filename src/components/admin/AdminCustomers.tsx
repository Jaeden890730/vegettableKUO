import { useState, useMemo } from 'react';
import { useCustomers } from '@/hooks/useCustomers';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, User, Key, BarChart3, Lock, Unlock } from 'lucide-react';

interface ItemStats {
  name: string;
  totalQuantity: number;
  unit: string;
}

export default function AdminCustomers() {
  const { customers, createCustomer, updateCustomer, deleteCustomer, resetPassword } = useCustomers();
  const { orders } = useOrders({ isAdmin: true });
  
  const [showDialog, setShowDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialsCustomerId, setCredentialsCustomerId] = useState<string | null>(null);
  const [credentialsCustomerName, setCredentialsCustomerName] = useState('');
  const [statsCustomerId, setStatsCustomerId] = useState<string | null>(null);
  const [statsCustomerName, setStatsCustomerName] = useState('');
  const [permissionsCustomer, setPermissionsCustomer] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [settlementCycle, setSettlementCycle] = useState<'weekly' | 'monthly'>('monthly');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  
  // Credentials form
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Calculate customer order totals by summing rounded subtotals
  const customerTotals = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach(order => {
      const current = totals.get(order.customer_id) || 0;
      // Sum rounded subtotals instead of recalculating
      const orderTotal = order.order_items?.reduce((sum, item) => {
        const unitPrice = Number((item as any).unit_price) || 0;
        const packs = Number((item as any).packs) || 1;
        const subtotal = Math.round(Number(item.quantity) * unitPrice * packs);
        return sum + subtotal;
      }, 0) || 0;
      totals.set(order.customer_id, current + orderTotal);
    });
    return totals;
  }, [orders]);

  // Calculate item stats for a specific customer
  const getCustomerItemStats = (customerId: string): ItemStats[] => {
    const statsMap = new Map<string, ItemStats>();
    
    orders
      .filter(order => order.customer_id === customerId)
      .forEach(order => {
        order.order_items?.forEach(item => {
          const name = item.custom_item_name || item.vegetable?.name || '未知品項';
          const packs = Number((item as any).packs) || 1;
          const quantity = Number(item.quantity) * packs;
          
          const existing = statsMap.get(name);
          if (existing) {
            existing.totalQuantity += quantity;
          } else {
            statsMap.set(name, { name, totalQuantity: quantity, unit: item.unit });
          }
        });
      });
    
    return Array.from(statsMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setContactPerson('');
    setSettlementCycle('monthly');
    setPassword('');
    setNote('');
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleOpenEdit = (customer: any) => {
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone || '');
    setContactPerson(customer.contact_person || '');
    setSettlementCycle(customer.settlement_cycle);
    setNote(customer.note || '');
    setPassword('');
    setShowDialog(true);
  };

  const handleOpenStats = (customer: any) => {
    setStatsCustomerId(customer.id);
    setStatsCustomerName(customer.name);
    setShowStatsDialog(true);
  };

  const handleOpenPermissions = (customer: any) => {
    setPermissionsCustomer(customer);
    setShowPermissionsDialog(true);
  };

  const handleTogglePermission = async (field: 'can_view_all_dates' | 'can_view_item_stats_detail', value: boolean) => {
    if (!permissionsCustomer) return;
    
    const { error } = await updateCustomer(permissionsCustomer.id, { [field]: value });
    if (error) {
      toast.error('更新失敗');
    } else {
      setPermissionsCustomer({ ...permissionsCustomer, [field]: value });
      toast.success('權限已更新');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('請輸入客戶名稱');
      return;
    }

    if (editingId) {
      const { error } = await updateCustomer(editingId, {
        name,
        phone: phone || null,
        contact_person: contactPerson || null,
        settlement_cycle: settlementCycle,
        note: note || null,
      });
      if (error) {
        toast.error('更新失敗');
      } else {
        toast.success('客戶已更新');
        setShowDialog(false);
        resetForm();
      }
    } else {
      const { error } = await createCustomer({
        name,
        phone: phone || undefined,
        contact_person: contactPerson || undefined,
        settlement_cycle: settlementCycle,
        note: note || undefined,
        password: password || undefined,
      });
      if (error) {
        toast.error('建立失敗');
      } else {
        toast.success('客戶已建立');
        setShowDialog(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string, customerName: string) => {
    if (!window.confirm(`確定要刪除客戶「${customerName}」嗎？`)) return;
    const { error } = await deleteCustomer(id);
    if (error) {
      toast.error('刪除失敗');
    } else {
      toast.success('客戶已刪除');
    }
  };

  const handleOpenCredentials = (customer: any) => {
    setCredentialsCustomerId(customer.id);
    setCredentialsCustomerName(customer.name);
    setNewPhone(customer.phone || '');
    setNewPassword('');
    setShowCredentialsDialog(true);
  };

  const handleSaveCredentials = async () => {
    if (!credentialsCustomerId) return;
    if (!newPhone.trim()) {
      toast.error('請輸入帳號');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('請輸入新密碼');
      return;
    }

    const { error } = await resetPassword(credentialsCustomerId, newPhone, newPassword);
    if (error) {
      toast.error('更新帳密失敗');
    } else {
      toast.success('帳號密碼已更新');
      setShowCredentialsDialog(false);
      setCredentialsCustomerId(null);
      setNewPhone('');
      setNewPassword('');
    }
  };

  const customerItemStats = statsCustomerId ? getCustomerItemStats(statsCustomerId) : [];
  const totalItems = customerItemStats.reduce((sum, item) => sum + item.totalQuantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">客戶管理</h2>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增客戶
        </Button>
      </div>

      <div className="space-y-2">
        {customers.map(customer => {
          const total = customerTotals.get(customer.id) || 0;
          return (
            <Card key={customer.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {customer.phone || '-'} · {customer.settlement_cycle === 'weekly' ? '週結' : '月結'}
                      </div>
                      {total > 0 && (
                        <div className="text-sm font-medium text-green-600">
                          訂單總額: ${total.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenPermissions(customer)} title="功能權限">
                      {customer.can_view_all_dates || customer.can_view_item_stats_detail ? (
                        <Unlock className="h-4 w-4 text-green-600" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenStats(customer)} title="品項統計">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenCredentials(customer)} title="修改帳密">
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(customer)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(customer.id, customer.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {customers.length === 0 && (
          <p className="text-center text-muted-foreground py-8">尚無客戶資料</p>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '編輯客戶' : '新增客戶'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">客戶名稱 *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="餐廳/攤商名" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">手機號碼（登入用）</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912345678" />
            </div>
            {!editingId && (
              <div>
                <label className="text-sm text-muted-foreground">登入密碼</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="設定密碼讓客戶可登入下單" />
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground">聯絡人</label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="聯絡人姓名" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">結帳週期</label>
              <Select value={settlementCycle} onValueChange={(v: any) => setSettlementCycle(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">週結</SelectItem>
                  <SelectItem value="monthly">月結</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">備註</label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="備註" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave}>{editingId ? '更新' : '建立'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改帳號密碼 - {credentialsCustomerName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">帳號（可用手機號碼或英文）</label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="輸入新帳號" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">新密碼 *</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="輸入新密碼" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>取消</Button>
            <Button onClick={handleSaveCredentials}>更新帳密</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Stats Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>品項統計 - {statsCustomerName}</DialogTitle>
          </DialogHeader>
          {customerItemStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">尚無訂單資料</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                共訂購 {totalItems.toLocaleString()} 單位，{customerItemStats.length} 種品項
              </p>
              {customerItemStats.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="text-primary font-medium">
                    {item.totalQuantity.toLocaleString()} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatsDialog(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>功能權限 - {permissionsCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">日期區間選擇</p>
                <p className="text-sm text-muted-foreground">解鎖後可在訂單與儀表板查看所有日期區間</p>
              </div>
              <Switch
                checked={permissionsCustomer?.can_view_all_dates || false}
                onCheckedChange={(checked) => handleTogglePermission('can_view_all_dates', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">品項統計詳情</p>
                <p className="text-sm text-muted-foreground">解鎖後可在儀表板查看訂購數量與金額</p>
              </div>
              <Switch
                checked={permissionsCustomer?.can_view_item_stats_detail || false}
                onCheckedChange={(checked) => handleTogglePermission('can_view_item_stats_detail', checked)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
