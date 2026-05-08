import { useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useSettlements } from '@/hooks/useSettlements';
import { useCustomers } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShoppingCart, CreditCard, Users, AlertCircle, Check, TrendingUp, Clock, ChevronDown } from 'lucide-react';
import { Order } from '@/types/order';
import { format } from 'date-fns';

type OrderStatusType = 'no_price' | 'has_price' | 'has_settlement' | 'paid';

const getOrderStatus = (order: Order, settlementOrderItemIds: Set<string>, paidOrderItemIds: Set<string>): OrderStatusType => {
  const orderItemIds = order.order_items?.map(item => item.id) || [];
  
  // Check if any order item is in a paid settlement
  const hasPaidSettlement = orderItemIds.some(id => paidOrderItemIds.has(id));
  if (hasPaidSettlement) return 'paid';
  
  // Check if any order item is in a settlement
  const hasSettlement = orderItemIds.some(id => settlementOrderItemIds.has(id));
  if (hasSettlement) return 'has_settlement';
  
  // Check if order has prices applied
  const hasPrice = order.order_items?.some(item => item.unit_price && Number(item.unit_price) > 0);
  if (hasPrice) return 'has_price';
  
  return 'no_price';
};

const OrderStatusIndicator = ({ status }: { status: OrderStatusType }) => {
  switch (status) {
    case 'paid':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'has_settlement':
      return <div className="h-3 w-3 rounded-full bg-green-500" />;
    case 'has_price':
      return <div className="h-3 w-3 rounded-full bg-yellow-500" />;
    case 'no_price':
      return <div className="h-3 w-3 rounded-full bg-red-500" />;
  }
};

const formatOrderTime = (createdAt: string) => {
  try {
    return format(new Date(createdAt), 'HH:mm');
  } catch {
    return '';
  }
};

export default function AdminDashboard() {
  const { orders } = useOrders({ isAdmin: true });
  const { settlements, getStats } = useSettlements({ isAdmin: true });
  const { customers } = useCustomers();
  const [isUnpaidOpen, setIsUnpaidOpen] = useState(false);

  const stats = getStats();

  // Calculate order stats
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.order_date === today);
  const todayNewOrdersCount = todayOrders.filter(o => 
    !o.order_items?.some(item => item.unit_price && Number(item.unit_price) > 0)
  ).length;

  // Calculate this week's revenue (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  
  const weeklyRevenue = orders
    .filter(o => o.order_date >= weekStartStr && o.order_date <= weekEndStr)
    .reduce((sum, order) => {
      // Sum rounded subtotals instead of recalculating
      const orderTotal = order.order_items?.reduce((itemSum, item) => {
        const unitPrice = Number(item.unit_price) || 0;
        const packs = Number((item as any).packs) || 1;
        const subtotal = Math.round(Number(item.quantity) * unitPrice * packs);
        return itemSum + subtotal;
      }, 0) || 0;
      return sum + orderTotal;
    }, 0);

  // Build sets of order_item_ids that are in settlements and paid settlements
  const settlementOrderItemIds = new Set<string>();
  const paidOrderItemIds = new Set<string>();
  
  settlements.forEach(settlement => {
    const isPaid = settlement.status === 'paid' || 
      (Number(settlement.total_amount) > 0 && Number(settlement.paid_amount) >= Number(settlement.total_amount));
    
    settlement.settlement_items?.forEach(item => {
      if (item.order_item_id) {
        settlementOrderItemIds.add(item.order_item_id);
        if (isPaid) {
          paidOrderItemIds.add(item.order_item_id);
        }
      }
    });
  });

  // Calculate customer outstanding with details using rounded subtotals
  const customerOutstanding = customers.map(customer => {
    const customerSettlements = settlements.filter(s => s.customer_id === customer.id);
    const outstanding = customerSettlements
      .filter(s => s.status !== 'paid')
      .reduce((sum, s) => {
        // Use rounded subtotals instead of total_amount
        const roundedTotal = s.settlement_items?.reduce(
          (itemSum, item) => itemSum + Math.round(Number(item.subtotal)), 0
        ) || Number(s.total_amount);
        return sum + (roundedTotal - Number(s.paid_amount));
      }, 0);
    return { ...customer, outstanding };
  }).filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">儀表板</h2>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日新訂單</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{todayNewOrdersCount}</div>
            <p className="text-xs text-muted-foreground">今日共 {todayOrders.length} 筆訂單</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本週營業額</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${weeklyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">已套用價格的訂單</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">未收款總額</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${stats.outstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">需追款結帳</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">客戶數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">活躍客戶</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-muted-foreground">狀態說明：</span>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>未套價</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span>已套價</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>已結帳</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-green-500" />
              <span>已收款</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Unpaid Stats - Collapsible */}
      {customerOutstanding.length > 0 && (
        <Collapsible open={isUnpaidOpen} onOpenChange={setIsUnpaidOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-destructive" />
                    客戶未收款統計
                    <span className="text-sm font-normal text-muted-foreground">
                      ({customerOutstanding.length} 位客戶)
                    </span>
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isUnpaidOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {customerOutstanding.map((customer, index) => (
                    <div key={customer.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                      <span className="font-bold text-destructive">${customer.outstanding.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Recent Orders with Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近訂單</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orders.slice(0, 8).map((order) => {
              const status = getOrderStatus(order, settlementOrderItemIds, paidOrderItemIds);
              return (
                <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <OrderStatusIndicator status={status} />
                    <div>
                      <span className="font-mono text-sm font-medium">{order.order_number}</span>
                      <span className="ml-2 text-muted-foreground">{order.customer?.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{order.order_date} {formatOrderTime(order.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
