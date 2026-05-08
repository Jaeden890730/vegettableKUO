import { useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useVegetables } from '@/hooks/useVegetables';
import { useSettlements } from '@/hooks/useSettlements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, DollarSign, FileText, Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EditingItem {
  id: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  packs: number;
  name: string;
  isNew?: boolean;
  vegetable_id?: string;
  custom_item_name?: string;
}

const UNIT_OPTIONS = ['斤', '公斤', '條', '把', '顆', '包', '盒', '份', '台斤', '件'];

interface Props {
  customerFilter?: string;
  onCustomerFilterChange?: (v: string) => void;
  syncControl?: React.ReactNode;
}

export default function AdminPendingSettlement({ customerFilter: externalFilter, onCustomerFilterChange, syncControl }: Props = {}) {
  const { orders, deleteOrder, updateOrderItems } = useOrders({ isAdmin: true });
  const { customers } = useCustomers();
  const { vegetables } = useVegetables(true);
  const { createSettlementFromOrder, createSettlementFromOrders } = useSettlements({ isAdmin: true });
  const [internalFilter, setInternalFilter] = useState<string>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const customerFilter = externalFilter !== undefined ? externalFilter : internalFilter;
  const setCustomerFilter = (v: string) => {
    if (onCustomerFilterChange) onCustomerFilterChange(v);
    else setInternalFilter(v);
  };
  const [searchTerm, setSearchTerm] = useState('');

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<EditingItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');

  const { settlements } = useSettlements({ isAdmin: true });
  // 收集所有「已完全付清」結帳單的 order_item_id（用來排除）
  const paidSettlements = settlements.filter(s => s.status === 'paid' || (s.paid_amount >= s.total_amount && s.total_amount > 0));
  const paidOrderItemIds = new Set<string>();
  paidSettlements.forEach(settlement => {
    settlement.settlement_items?.forEach(item => {
      if (item.order_item_id) {
        paidOrderItemIds.add(item.order_item_id);
      }
    });
  });

  // 建立 order_item_id -> 結帳單狀態 對照（用於顯示標籤）
  const orderItemSettlementStatus = new Map<string, { status: string; settlementNumber: string }>();
  settlements.forEach(settlement => {
    settlement.settlement_items?.forEach(item => {
      if (item.order_item_id) {
        orderItemSettlementStatus.set(item.order_item_id, {
          status: settlement.status,
          settlementNumber: settlement.settlement_number,
        });
      }
    });
  });

  const getOrderPaymentStatus = (order: typeof orders[0]): 'no_settlement' | 'partial_paid' | 'unpaid_settlement' => {
    const items = order.order_items || [];
    const statuses = items
      .map(i => orderItemSettlementStatus.get(i.id)?.status)
      .filter(Boolean) as string[];
    if (statuses.length === 0) return 'no_settlement';
    if (statuses.some(s => s === 'partial_paid')) return 'partial_paid';
    return 'unpaid_settlement';
  };

  const pendingSettlementOrders = orders.filter(order => {
    const pricedItems = order.order_items?.filter(item => item.unit_price && item.unit_price > 0) || [];
    if (pricedItems.length === 0) return false;
    // 全部品項都已付清 → 隱藏
    const allInPaid = pricedItems.every(item => paidOrderItemIds.has(item.id));
    if (allInPaid) return false;
    if (customerFilter !== 'all' && order.customer_id !== customerFilter) return false;
    if (searchTerm && !order.order_number.includes(searchTerm)) return false;
    return true;
  });

  const handleDelete = async (orderId: string, orderNumber: string) => {
    if (!confirm(`確定要刪除訂單 ${orderNumber} 嗎？`)) return;
    const { error } = await deleteOrder(orderId);
    if (error) toast.error('刪除失敗');
    else toast.success('訂單已刪除');
  };

  const handleCreateSettlement = async (orderId: string, orderNumber: string) => {
    const { error } = await createSettlementFromOrder(orderId);
    if (error) toast.error('產生結帳單失敗');
    else toast.success(`已從訂單 ${orderNumber} 產生結帳單`);
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleBulkCreateSettlement = async () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) {
      toast.error('請先勾選訂單');
      return;
    }
    const selectedOrders = orders.filter(o => ids.includes(o.id));
    const customerIds = new Set(selectedOrders.map(o => o.customer_id));
    if (customerIds.size > 1) {
      toast.error('所選訂單必須屬於同一位客戶');
      return;
    }
    if (!confirm(`確定要將 ${ids.length} 張訂單合併為一張結帳單？`)) return;
    const { error } = await createSettlementFromOrders(ids);
    if (error) {
      toast.error((error as Error).message || '產生結帳單失敗');
    } else {
      toast.success(`已合併 ${ids.length} 張訂單為結帳單`);
      setSelectedOrderIds(new Set());
    }
  };

  const handleStartEdit = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.order_items) return;

    const items: EditingItem[] = order.order_items.map(item => {
      let unitPrice = item.unit_price || 0;
      if (unitPrice === 0 && item.vegetable_id) {
        const veg = vegetables.find(v => v.id === item.vegetable_id);
        if (veg) {
          const matchingPrice = veg.prices.find(p => p.unit === item.unit);
          if (matchingPrice) unitPrice = matchingPrice.price;
          else if (veg.prices.length > 0) unitPrice = veg.prices[0].price;
          else unitPrice = veg.price;
        }
      }
      return {
        id: item.id,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice,
        packs: Number((item as any).packs) || 1,
        name: item.custom_item_name || item.vegetable?.name || '未知品項',
      };
    });

    setEditingItems(items);
    setDeletedItemIds([]);
    setEditingOrderId(orderId);
    setShowAddItem(false);
    setCustomItemName('');
  };

  const handleEditItem = (itemId: string, field: keyof EditingItem, value: string | number) => {
    setEditingItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, [field]: field === 'unit' ? value : (typeof value === 'string' ? parseFloat(value) || 0 : value) } : item
    ));
  };

  const handleDeleteItem = (itemId: string) => {
    const item = editingItems.find(i => i.id === itemId);
    if (!item) return;
    setEditingItems(prev => prev.filter(i => i.id !== itemId));
    if (!item.isNew) setDeletedItemIds(prev => [...prev, itemId]);
  };

  const handleAddVegetableItem = (vegId: string) => {
    const veg = vegetables.find(v => v.id === vegId);
    if (!veg) return;
    const price = veg.prices.length > 0 ? veg.prices[0].price : veg.price;
    const unit = veg.prices.length > 0 ? veg.prices[0].unit : veg.unit;
    setEditingItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      quantity: 1,
      unit,
      unitPrice: price,
      packs: 1,
      name: veg.name,
      isNew: true,
      vegetable_id: veg.id,
    }]);
    setShowAddItem(false);
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    setEditingItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      quantity: 1,
      unit: '斤',
      unitPrice: 0,
      packs: 1,
      name: customItemName.trim(),
      isNew: true,
      custom_item_name: customItemName.trim(),
    }]);
    setCustomItemName('');
    setShowAddItem(false);
  };

  const handleSaveEdit = async () => {
    if (!editingOrderId) return;

    const existingItems = editingItems.filter(i => !i.isNew).map(i => ({
      id: i.id,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      packs: i.packs,
    }));
    const newItems = editingItems.filter(i => i.isNew).map(i => ({
      vegetable_id: i.vegetable_id,
      custom_item_name: i.custom_item_name,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      packs: i.packs,
    }));

    const { error } = await updateOrderItems(
      editingOrderId,
      existingItems,
      undefined,
      newItems.length > 0 ? newItems : undefined,
      deletedItemIds.length > 0 ? deletedItemIds : undefined,
    );
    if (error) {
      toast.error('儲存失敗');
    } else {
      toast.success('訂單已更新');
      setEditingOrderId(null);
      setEditingItems([]);
      setDeletedItemIds([]);
    }
  };

  const editingOrder = orders.find(o => o.id === editingOrderId);
  const addableVegetables = vegetables.filter(v => v.status !== 'hidden' && v.status !== 'out_of_stock');

  const totalUnpaidAmount = pendingSettlementOrders.reduce((sum, order) => {
    return sum + (order.order_items || []).reduce((s, item) => {
      const packs = (item as any).packs || 1;
      return s + Math.round(Number(item.quantity) * Number(item.unit_price || 0) * packs);
    }, 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">未收款訂單</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{pendingSettlementOrders.length} 筆</span>
          <span className="text-lg font-bold text-destructive">未收 ${totalUnpaidAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋訂單編號"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="客戶" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部客戶</SelectItem>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {syncControl}
      </div>

      {selectedOrderIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-primary/10 border border-primary/30">
          <span className="text-sm font-medium">已選 {selectedOrderIds.size} 張訂單</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedOrderIds(new Set())}>清除選取</Button>
            <Button size="sm" onClick={handleBulkCreateSettlement}>
              <FileText className="h-4 w-4 mr-1" />
              產生結帳單（合併）
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {pendingSettlementOrders.map(order => {
          const paymentStatus = getOrderPaymentStatus(order);
          const statusLabel =
            paymentStatus === 'no_settlement' ? { text: '未開單', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' } :
            paymentStatus === 'partial_paid' ? { text: '部分付款', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' } :
            { text: '已開單未付', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
          return (
          <Card key={order.id} className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedOrderIds.has(order.id)}
                    onCheckedChange={() => toggleSelectOrder(order.id)}
                    aria-label="選取訂單"
                  />
                  <span className="font-mono font-bold">{order.order_number}</span>
                  <span className="text-primary font-medium">{order.customer?.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusLabel.cls}`}>
                    {statusLabel.text}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{order.order_date} {format(new Date(order.created_at), 'HH:mm')}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleStartEdit(order.id)} title="編輯訂單">
                    <DollarSign className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCreateSettlement(order.id, order.order_number)} title="產生結帳單">
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(order.id, order.order_number)} title="刪除訂單">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {order.order_items && order.order_items.length > 0 && (
                <div className="border-t pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {order.order_items.map(item => {
                      const unitPrice = item.unit_price || 0;
                      const packs = (item as any).packs || 1;
                      const subtotal = Math.round(item.quantity * unitPrice * packs);
                      return (
                        <div key={item.id} className="text-sm bg-muted/50 rounded px-2 py-1 flex justify-between items-center">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{item.custom_item_name || item.vegetable?.name}</span>
                            <span className="text-muted-foreground">
                              ×{item.quantity}{item.unit}
                              {packs > 1 && ` ×${packs}份`}
                            </span>
                            <span className="text-muted-foreground">${unitPrice}</span>
                          </div>
                          <span className="font-medium text-primary">${subtotal.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-right font-bold text-primary">
                    訂單總額: ${order.order_items.reduce((sum, item) => {
                      const packs = (item as any).packs || 1;
                      return sum + Math.round(item.quantity * (item.unit_price || 0) * packs);
                    }, 0).toLocaleString()}
                  </div>
                </div>
              )}

              {order.note && (
                <div className="mt-2 text-sm text-muted-foreground">
                  備註：{order.note}
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
        {pendingSettlementOrders.length === 0 && (
          <p className="text-center text-muted-foreground py-8">沒有未收款訂單</p>
        )}
      </div>

      <Dialog open={!!editingOrderId} onOpenChange={() => setEditingOrderId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯訂單 {editingOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">調整數量、單位、份數與單價</p>
            {editingItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDeleteItem(item.id)}
                  title="刪除品項"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <span className="flex-1 min-w-[80px] font-medium text-sm truncate">{item.name}</span>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleEditItem(item.id, 'quantity', e.target.value)}
                  className="w-16 h-8 text-sm"
                  placeholder="數量"
                />
                <Select value={item.unit} onValueChange={(v) => handleEditItem(item.id, 'unit', v)}>
                  <SelectTrigger className="w-16 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm">x</span>
                <Input
                  type="number"
                  value={item.packs}
                  onChange={(e) => handleEditItem(item.id, 'packs', e.target.value)}
                  className="w-12 h-8 text-sm px-1"
                  placeholder="份數"
                  title="份數"
                />
                <span className="text-sm">份</span>
                <span className="text-sm">$</span>
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => handleEditItem(item.id, 'unitPrice', e.target.value)}
                  className="w-16 h-8 text-sm"
                  placeholder="單價"
                />
                <span className="text-sm font-medium w-16 text-right">
                  ${Math.round(item.quantity * item.unitPrice * (item.packs || 1)).toLocaleString()}
                </span>
              </div>
            ))}

            {!showAddItem ? (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddItem(true)}>
                <Plus className="h-4 w-4 mr-1" />
                新增品項
              </Button>
            ) : (
              <div className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">新增品項</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowAddItem(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Select onValueChange={handleAddVegetableItem}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="從菜單選擇..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {addableVegetables.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder="自訂品項名稱"
                    className="h-8 text-sm flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
                  />
                  <Button size="sm" className="h-8" onClick={handleAddCustomItem} disabled={!customItemName.trim()}>
                    加入
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t pt-2 text-right font-bold">
              總計: ${editingItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * (item.packs || 1)), 0).toLocaleString()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrderId(null)}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={editingItems.length === 0}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
