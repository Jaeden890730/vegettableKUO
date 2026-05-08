import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { TrendingUp, Package } from 'lucide-react';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

interface ItemStats {
  name: string;
  totalQuantity: number;
  totalAmount: number;
  unit: string;
}

export default function AdminAnalytics() {
  const { orders } = useOrders({ isAdmin: true });
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

  const itemStats = useMemo(() => {
    const statsMap = new Map<string, ItemStats>();

    orders.forEach(order => {
      // Filter by date range
      if (start && order.order_date < start) return;
      if (end && order.order_date > end) return;

      order.order_items?.forEach(item => {
        const name = item.custom_item_name || item.vegetable?.name || '未知品項';
        const unitPrice = Number((item as any).unit_price) || 0;
        const packs = Number((item as any).packs) || 1;
        const quantity = Number(item.quantity) * packs;
        const amount = quantity * unitPrice;

        const existing = statsMap.get(name);
        if (existing) {
          existing.totalQuantity += quantity;
          existing.totalAmount += amount;
        } else {
          statsMap.set(name, {
            name,
            totalQuantity: quantity,
            totalAmount: amount,
            unit: item.unit,
          });
        }
      });
    });

    return Array.from(statsMap.values())
      .map(item => ({ ...item, totalAmount: Math.round(item.totalAmount) }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [orders, start, end]);

  const totalAmount = useMemo(() => {
    return Math.round(itemStats.reduce((sum, item) => sum + item.totalAmount, 0));
  }, [itemStats]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">分析</h2>

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-4 w-4 text-primary" />
              品項數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{itemStats.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              總銷售額
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">${totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Item Stats Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">品項訂購統計</CardTitle>
        </CardHeader>
        <CardContent>
          {itemStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">此區間無訂單資料</p>
          ) : (
            <div className="space-y-2">
              {itemStats.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <p className="text-sm text-muted-foreground">
                        共 {item.totalQuantity.toLocaleString()} {item.unit}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-green-600">${item.totalAmount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
