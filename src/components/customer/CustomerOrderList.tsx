import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ShoppingCart, Store } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

interface Props {
  customerId: string | null;
}

export default function CustomerOrderList({ customerId }: Props) {
  const { orders, isLoading: ordersLoading } = useOrders({ customerId, isAdmin: false });
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const getDateFilters = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'week':
        return { 
          start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), 
          end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') 
        };
      case 'month':
        return { 
          start: format(startOfMonth(today), 'yyyy-MM-dd'), 
          end: format(endOfMonth(today), 'yyyy-MM-dd') 
        };
      case 'year':
        return { 
          start: format(startOfYear(today), 'yyyy-MM-dd'), 
          end: format(endOfYear(today), 'yyyy-MM-dd') 
        };
      case 'custom':
        return { start: customStart, end: customEnd };
      case 'all':
      default:
        return { start: '', end: '' };
    }
  };

  const { start, end } = getDateFilters();

  // Filter orders by date range
  const dateFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (start && order.order_date < start) return false;
      if (end && order.order_date > end) return false;
      return true;
    });
  }, [orders, start, end]);

  if (ordersLoading) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>;
  }

  const renderOrderCard = (order: typeof orders[0]) => {
    // Calculate order total by summing rounded subtotals
    const orderTotal = order.order_items?.reduce((sum, item) => {
      const unitPrice = Number((item as any).unit_price) || 0;
      const packs = Number((item as any).packs) || 1;
      const subtotal = Math.round(Number(item.quantity) * unitPrice * packs);
      return sum + subtotal;
    }, 0) || 0;
    
    const hasPrices = order.order_items?.some(item => {
      const unitPrice = Number((item as any).unit_price);
      return unitPrice > 0;
    });
    
    const merchantNote = (order as any).merchant_note;

    return (
      <Card key={order.id}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono font-bold text-foreground">{order.order_number}</span>
            <span className="text-sm text-muted-foreground">{order.order_date}</span>
          </div>
          
          {order.order_items && order.order_items.length > 0 && (
            <div className="space-y-1">
              {order.order_items.map(item => {
                const unitPrice = Number((item as any).unit_price) || 0;
                const packs = Number((item as any).packs) || 1;
                const subtotal = Math.round(Number(item.quantity) * unitPrice * packs);
                
                return (
                  <div key={item.id} className="flex justify-between items-center text-sm bg-muted/50 rounded px-2 py-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-medium">{item.custom_item_name || item.vegetable?.name}</span>
                      <span className="text-muted-foreground">
                        ×{item.quantity}{item.unit}
                        {packs > 1 && ` ×${packs}份`}
                      </span>
                      {hasPrices && unitPrice > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ${unitPrice}/{item.unit}
                        </span>
                      )}
                    </div>
                    {hasPrices && unitPrice > 0 && (
                      <span className="text-primary font-medium ml-2 whitespace-nowrap">${subtotal.toLocaleString()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {hasPrices && orderTotal > 0 && (
            <div className="mt-3 pt-2 border-t border-border text-right">
              <span className="font-bold text-foreground">
                小計: ${orderTotal.toLocaleString()}
              </span>
            </div>
          )}
          
          {order.note && (
            <div className="mt-2 text-sm text-muted-foreground">
              備註：{order.note}
            </div>
          )}

          {merchantNote && (
            <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                <Store className="h-3 w-3" />
                商家備註
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">{merchantNote}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">歷史訂單</h2>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="today">今日</TabsTrigger>
            <TabsTrigger value="week">當週</TabsTrigger>
            <TabsTrigger value="month">當月</TabsTrigger>
            <TabsTrigger value="year">今年</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="custom">自選</TabsTrigger>
          </TabsList>
        </Tabs>
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-36"
            />
            <span>~</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-36"
            />
          </div>
        )}
      </div>

      {/* Order List */}
      <div className="space-y-3">
        {dateFilteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">此區間無訂單紀錄</p>
            </CardContent>
          </Card>
        ) : (
          dateFilteredOrders.map(order => renderOrderCard(order))
        )}
      </div>
    </div>
  );
}
