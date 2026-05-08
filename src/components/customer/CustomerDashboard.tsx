import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useOrders } from '@/hooks/useOrders';
import { useSettlements } from '@/hooks/useSettlements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { DollarSign, CreditCard, AlertCircle, Package } from 'lucide-react';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

interface Props {
  customerId: string | null;
  canViewAllDates?: boolean;
  canViewItemStatsDetail?: boolean;
}

export default function CustomerDashboard({ customerId, canViewAllDates = false, canViewItemStatsDetail = false }: Props) {
  const { orders } = useOrders({ customerId: customerId || undefined, isAdmin: false });
  const { settlements } = useSettlements({ customerId: customerId || undefined });
  const [dateRange, setDateRange] = useState<DateRange>('week');
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

  // Calculate paid order item IDs
  const paidOrderItemIds = useMemo(() => {
    const paidIds = new Set<string>();
    const paidSettlements = settlements.filter(s => 
      s.status === 'paid' || (s.paid_amount >= s.total_amount && s.total_amount > 0)
    );
    paidSettlements.forEach(settlement => {
      settlement.settlement_items?.forEach(item => {
        if (item.order_item_id) {
          paidIds.add(item.order_item_id);
        }
      });
    });
    return paidIds;
  }, [settlements]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    const itemStatsMap = new Map<string, { name: string; quantity: number; amount: number; unit: string }>();

    orders.forEach(order => {
      // Filter by date range
      if (start && order.order_date < start) return;
      if (end && order.order_date > end) return;

      order.order_items?.forEach(item => {
        const unitPrice = Number((item as any).unit_price) || 0;
        const packs = Number((item as any).packs) || 1;
        const quantity = Number(item.quantity) * packs;
        const subtotal = quantity * unitPrice;

        if (unitPrice > 0) {
          totalAmount += subtotal;
          
          if (paidOrderItemIds.has(item.id)) {
            paidAmount += subtotal;
          } else {
            unpaidAmount += subtotal;
          }
        }

        // Item stats
        const name = item.custom_item_name || item.vegetable?.name || '未知品項';
        const existing = itemStatsMap.get(name);
        if (existing) {
          existing.quantity += quantity;
          existing.amount += subtotal;
        } else {
          itemStatsMap.set(name, { name, quantity, amount: subtotal, unit: item.unit });
        }
      });
    });

    const itemStats = Array.from(itemStatsMap.values())
      .map(item => ({ ...item, amount: Math.round(item.amount) }))
      .sort((a, b) => b.quantity - a.quantity);

    return { 
      totalAmount: Math.round(totalAmount), 
      paidAmount: Math.round(paidAmount), 
      unpaidAmount: Math.round(unpaidAmount), 
      itemStats 
    };
  }, [orders, start, end, paidOrderItemIds]);

  return (
    <div className="space-y-4">
      {/* Date Range Selector */}
      {canViewAllDates ? (
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
      ) : (
        <div className="text-sm text-muted-foreground">
          顯示區間：當週
        </div>
      )}

      {/* Summary Cards - always show */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              總額
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold">${stats.totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3 text-green-500" />
              已付
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold text-green-600">${stats.paidAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              未付
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold text-amber-600">${stats.unpaidAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Item Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            品項訂購統計
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.itemStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">此區間無訂單資料</p>
          ) : (
            <div className="space-y-2">
              {stats.itemStats.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5">{index + 1}.</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {canViewItemStatsDetail && (
                    <div className="text-right">
                      <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                      {item.amount > 0 && (
                        <span className="ml-2 font-medium text-green-600">${item.amount.toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
