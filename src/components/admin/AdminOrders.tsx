import { useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useVegetables } from '@/hooks/useVegetables';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Trash2, DollarSign, Clock, Plus, X, Pencil } from 'lucide-react';
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

export default function AdminOrders() {
  const { orders, deleteOrder, updateOrderItems } = useOrders({ isAdmin: true });
  const { customers } = useCustomers();
  const { vegetables } = useVegetables(true);
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<EditingItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [merchantNote, setMerchantNote] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<string>('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');

  // Filter only orders that have NO prices applied (new orders)
  const newOrders = orders.filter(order => {
    const hasPrices = order.order_items?.some(item => Number((item as any).unit_price) > 0);
    if (hasPrices) return false;
    if (customerFilter !== 'all' && order.customer_id !== customerFilter) return false;
    if (searchTerm && !order.order_number.includes(searchTerm)) return false;
    return true;
  });

  const handleDelete = async (orderId: string, orderNumber: string) => {
    if (!confirm(`確定要刪除訂單 ${orderNumber} 嗎？`)) return;
    const { error } = await deleteOrder(orderId);
    if (error) {
      toast.error('刪除失敗');
    } else {
      toast.success('訂單已刪除');
    }
  };

  const handleApplyCurrentPrices = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.order_items) return;

    const items: EditingItem[] = order.order_items.map(item => {
      let unitPrice = 0;
      if (item.vegetable_id) {
        const veg = vegetables.find(v => v.id === item.vegetable_id);
        if (veg) {
          const matchingPrice = veg.prices.find(p => p.unit === item.unit);
          if (matchingPrice) {
            unitPrice = matchingPrice.price;
          } else if (veg.prices.length > 0) {
            unitPrice = veg.prices[0].price;
          } else {
            unitPrice = veg.price;
          }
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
    setMerchantNote((order as any).merchant_note || '');
    setEditingCustomerId(order.customer_id);
    setShowAddItem(false);
    setCustomItemName('');
    toast.success('已套用當前價格，可繼續修改');
  };

  const handleEditWithoutPrices = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.order_items) return;

    const items: EditingItem[] = order.order_items.map(item => ({
      id: item.id,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number((item as any).unit_price) || 0,
      packs: Number((item as any).packs) || 1,
      name: item.custom_item_name || item.vegetable?.name || '未知品項',
    }));

    setEditingItems(items);
    setDeletedItemIds([]);
    setEditingOrderId(orderId);
    setMerchantNote((order as any).merchant_note || '');
    setEditingCustomerId(order.customer_id);
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
    if (!item.isNew) {
      setDeletedItemIds(prev => [...prev, itemId]);
    }
  };

  const handleAddVegetableItem = (vegId: string) => {
    const veg = vegetables.find(v => v.id === vegId);
    if (!veg) return;
    const price = veg.prices.length > 0 ? veg.prices[0].price : veg.price;
    const unit = veg.prices.length > 0 ? veg.prices[0].unit : veg.unit;
    const newItem: EditingItem = {
      id: `new-${Date.now()}`,
      quantity: 1,
      unit,
      unitPrice: price,
      packs: 1,
      name: veg.name,
      isNew: true,
      vegetable_id: veg.id,
    };
    setEditingItems(prev => [...prev, newItem]);
    setShowAddItem(false);
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    const newItem: EditingItem = {
      id: `new-${Date.now()}`,
      quantity: 1,
      unit: '斤',
      unitPrice: 0,
      packs: 1,
      name: customItemName.trim(),
      isNew: true,
      custom_item_name: customItemName.trim(),
    };
    setEditingItems(prev => [...prev, newItem]);
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
      merchantNote,
      newItems.length > 0 ? newItems : undefined,
      deletedItemIds.length > 0 ? deletedItemIds : undefined,
      editingCustomerId && editingCustomerId !== editingOrder?.customer_id
        ? { customerId: editingCustomerId }
        : undefined,
    );
    if (error) {
      toast.error('儲存失敗');
    } else {
      toast.success('訂單已更新，已移至待結訂單');
      setEditingOrderId(null);
      setEditingItems([]);
      setDeletedItemIds([]);
      setMerchantNote('');
    }
  };

  const editingOrder = orders.find(o => o.id === editingOrderId);

  // Vegetables available to add (filter out already-added ones)
  const addableVegetables = vegetables.filter(v => 
    v.status !== 'hidden' && v.status !== 'out_of_stock'
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">訂單管理</h2>
        <span className="text-muted-foreground">{newOrders.length} 筆新訂單</span>
      </div>

      {/* Filters */}
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
      </div>

      {/* New Orders Only */}
      <div className="space-y-3">
        {newOrders.map(order => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold">{order.order_number}</span>
                  <span className="text-primary font-medium">{order.customer?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{order.order_date} {format(new Date(order.created_at), 'HH:mm')}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEditWithoutPrices(order.id)}
                    title="編輯訂單（不套價）"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleApplyCurrentPrices(order.id)}
                    title="套用當前價格並編輯"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDelete(order.id, order.order_number)}
                    title="刪除訂單"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Order Items - Simple display without prices */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="border-t pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {order.order_items.map(item => (
                      <div key={item.id} className="text-sm bg-muted/50 rounded px-2 py-1 flex items-center gap-1">
                        <span className="font-medium">{item.custom_item_name || item.vegetable?.name}</span>
                        <span className="text-muted-foreground">
                          x{item.quantity}{item.unit}
                          {(item as any).packs > 1 && ` x${(item as any).packs}份`}
                        </span>
                      </div>
                    ))}
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
        ))}
        {newOrders.length === 0 && (
          <p className="text-center text-muted-foreground py-8">沒有新訂單</p>
        )}
      </div>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrderId} onOpenChange={() => setEditingOrderId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯訂單 {editingOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">已套用當前價格，儲存後將移至待結訂單</p>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">下單者</label>
              <Select value={editingCustomerId} onValueChange={setEditingCustomerId}>
                <SelectTrigger className="h-9 text-sm flex-1">
                  <SelectValue placeholder="選擇客戶" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter(c => c.is_active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                {UNIT_OPTIONS.includes(item.unit) ? (
                  <Select
                    value={item.unit}
                    onValueChange={(v) => {
                      if (v === '__custom__') {
                        handleEditItem(item.id, 'unit', '');
                      } else {
                        handleEditItem(item.id, 'unit', v);
                      }
                    }}
                  >
                    <SelectTrigger className="w-16 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">✏️ 自訂</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleEditItem(item.id, 'unit', e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) handleEditItem(item.id, 'unit', '斤');
                    }}
                    className="w-16 h-8 text-sm px-1"
                    placeholder="單位"
                    autoFocus
                  />
                )}
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

            {/* Add Item Section */}
            {!showAddItem ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAddItem(true)}
              >
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
                {/* From vegetable list */}
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
                {/* Custom item */}
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
            <div className="pt-2">
              <label className="text-sm text-muted-foreground">商家備註（客戶可見）</label>
              <Input
                value={merchantNote}
                onChange={(e) => setMerchantNote(e.target.value)}
                placeholder="輸入備註給客戶看"
              />
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