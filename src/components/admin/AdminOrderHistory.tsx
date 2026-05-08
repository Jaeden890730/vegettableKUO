import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Search, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useSettlements } from '@/hooks/useSettlements';
import { Order, Settlement } from '@/types/order';

export default function AdminOrderHistory() {
  const { orders, isLoading: ordersLoading } = useOrders({ isAdmin: true });
  const { customers } = useCustomers();
  const { settlements, isLoading: settlementsLoading } = useSettlements({ isAdmin: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [expandedSettlements, setExpandedSettlements] = useState<Set<string>>(new Set());

  // 已收款結帳單（status = 'paid' 或實付 >= 應收）
  const paidSettlements = useMemo(() => {
    return settlements.filter(
      s => s.status === 'paid' || (s.paid_amount >= s.total_amount && s.total_amount > 0)
    );
  }, [settlements]);

  // 建立 order_item_id -> order 的 map，方便查找對應訂單
  const orderByItemId = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        map.set(item.id, order);
      });
    });
    return map;
  }, [orders]);

  // 為每張結帳單，找出它涵蓋了哪些訂單（透過 settlement_items.order_item_id）
  const settlementsWithOrders = useMemo(() => {
    return paidSettlements.map(settlement => {
      const orderMap = new Map<string, Order>();
      settlement.settlement_items?.forEach(si => {
        if (si.order_item_id) {
          const order = orderByItemId.get(si.order_item_id);
          if (order) orderMap.set(order.id, order);
        }
      });
      return {
        settlement,
        relatedOrders: Array.from(orderMap.values()).sort(
          (a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
        ),
      };
    });
  }, [paidSettlements, orderByItemId]);

  // 篩選
  const filtered = settlementsWithOrders.filter(({ settlement, relatedOrders }) => {
    const matchesCustomer =
      selectedCustomer === 'all' || settlement.customer_id === selectedCustomer;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      settlement.settlement_number.toLowerCase().includes(term) ||
      settlement.customer?.name?.toLowerCase().includes(term) ||
      relatedOrders.some(o => o.order_number.toLowerCase().includes(term));
    return matchesCustomer && matchesSearch;
  });

  const toggleExpand = (id: string) => {
    setExpandedSettlements(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const calcOrderTotal = (order: Order) => {
    return (
      order.order_items?.reduce((sum, item) => {
        const packs = item.packs || 1;
        return sum + Math.round(item.quantity * packs * (item.unit_price || 0));
      }, 0) || 0
    );
  };

  if (ordersLoading || settlementsLoading) {
    return <div className="p-6">載入中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">歷史訂單</h2>
        <p className="text-muted-foreground">已完成收款的結帳單</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋結帳單號／訂單編號／客戶..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="選擇客戶" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部客戶</SelectItem>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Settlement List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>目前沒有已收款的結帳單</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ settlement, relatedOrders }) => {
            const expanded = expandedSettlements.has(settlement.id);
            return (
              <div key={settlement.id} className="bg-card border rounded-lg overflow-hidden">
                {/* Settlement header */}
                <button
                  onClick={() => toggleExpand(settlement.id)}
                  className="w-full p-4 flex justify-between items-start hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-start gap-2">
                    {expanded ? (
                      <ChevronDown className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {settlement.settlement_number}
                        </span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          已收款
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {settlement.customer?.name} ·{' '}
                        {format(new Date(settlement.period_start), 'yyyy/MM/dd', { locale: zhTW })}
                        {' ~ '}
                        {format(new Date(settlement.period_end), 'MM/dd', { locale: zhTW })}
                        {' · '}
                        共 {relatedOrders.length} 張訂單
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-foreground">
                      ${Math.round(Number(settlement.total_amount)).toLocaleString()}
                    </p>
                  </div>
                </button>

                {/* Expanded: orders inside this settlement */}
                {expanded && (
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    {relatedOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">此結帳單沒有對應的訂單資料</p>
                    ) : (
                      relatedOrders.map(order => (
                        <div key={order.id} className="bg-card border rounded-md p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-foreground">
                                {order.order_number}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {format(new Date(order.order_date), 'yyyy/MM/dd', {
                                  locale: zhTW,
                                })}
                              </span>
                            </div>
                            <p className="font-semibold text-foreground">
                              ${calcOrderTotal(order).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 text-sm">
                            {order.order_items?.map(item => {
                              const packs = item.packs || 1;
                              const subtotal = Math.round(
                                item.quantity * packs * (item.unit_price || 0)
                              );
                              return (
                                <div
                                  key={item.id}
                                  className="flex justify-between text-muted-foreground"
                                >
                                  <span>
                                    {item.vegetable?.name || item.custom_item_name}{' '}
                                    {item.quantity} {item.unit}
                                    {packs > 1 && (
                                      <span className="text-foreground"> x {packs} 份</span>
                                    )}
                                  </span>
                                  <span>
                                    ${item.unit_price}/{item.unit} = $
                                    {subtotal.toLocaleString()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {order.note && (
                            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                              備註：{order.note}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
