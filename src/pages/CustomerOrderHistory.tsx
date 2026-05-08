import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ShoppingCart, Store } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useOrders } from '@/hooks/useOrders';
import { useSettlements } from '@/hooks/useSettlements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CustomerOrderHistory() {
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer, customerId, customerName, isLoading: authLoading, signOut } = useSupabaseAuth();
  const { orders, isLoading: ordersLoading } = useOrders({ customerId, isAdmin: false });
  const { settlements, isLoading: settlementsLoading } = useSettlements({ customerId });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isCustomer)) {
      navigate('/customer-auth');
    }
  }, [isAuthenticated, isCustomer, authLoading, navigate]);

  // Find paid order item ids to exclude fully paid orders
  const paidOrderItemIds = useMemo(() => {
    const paidIds = new Set<string>();
    const paidSettlements = settlements.filter(s => s.status === 'paid' || (s.paid_amount >= s.total_amount && s.total_amount > 0));
    paidSettlements.forEach(settlement => {
      settlement.settlement_items?.forEach(item => {
        if (item.order_item_id) {
          paidIds.add(item.order_item_id);
        }
      });
    });
    return paidIds;
  }, [settlements]);

  // Check if an order is fully paid
  const isOrderPaid = (order: typeof orders[0]) => {
    const pricedItems = order.order_items?.filter(item => {
      const unitPrice = Number((item as any).unit_price);
      return unitPrice > 0;
    }) || [];
    if (pricedItems.length === 0) return false;
    return pricedItems.every(item => paidOrderItemIds.has(item.id));
  };

  // Calculate total accumulated amount (only unpaid orders)
  const totalAmount = useMemo(() => {
    return orders.reduce((total, order) => {
      if (isOrderPaid(order)) return total;
      const orderTotal = order.order_items?.reduce((sum, item) => {
        const unitPrice = Number((item as any).unit_price) || 0;
        const packs = Number((item as any).packs) || 1;
        return sum + Number(item.quantity) * unitPrice * packs;
      }, 0) || 0;
      return total + orderTotal;
    }, 0);
  }, [orders, paidOrderItemIds]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || ordersLoading || settlementsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/customer-order')}
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
              返回下單
            </button>
            <h1 className="text-lg font-bold">歷史訂單</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="container py-4 space-y-4">
        {/* Customer info */}
        <div className="text-center py-2">
          <span className="text-lg font-medium text-foreground">{customerName}</span>
          <span className="text-muted-foreground ml-2">的歷史訂單</span>
        </div>

        {/* Total accumulated amount */}
        {totalAmount > 0 && (
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="py-4 text-center">
              <span className="text-muted-foreground">累積金額</span>
              <p className="text-2xl font-bold text-primary">${totalAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
        )}

        {/* Orders list */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">尚無訂單紀錄</p>
              <Button 
                onClick={() => navigate('/customer-order')} 
                className="mt-4"
              >
                開始下單
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isPaid = isOrderPaid(order);
              // Check if any item has price applied
              const hasPrices = order.order_items?.some(item => {
                const unitPrice = Number((item as any).unit_price);
                return unitPrice > 0;
              });

              const orderTotal = order.order_items?.reduce((sum, item) => {
                const unitPrice = Number((item as any).unit_price) || 0;
                const packs = Number((item as any).packs) || 1;
                return sum + Number(item.quantity) * unitPrice * packs;
              }, 0) || 0;

              return (
                <Card 
                  key={order.id}
                  className={isPaid 
                    ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20' 
                    : hasPrices 
                      ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' 
                      : 'border-muted'
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{order.order_number}</span>
                        {hasPrices && !isPaid && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
                            待結
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{order.order_date}</span>
                    </div>
                    
                    {/* Order items */}
                    {order.order_items && order.order_items.length > 0 && (
                      <div className="space-y-1">
                        {order.order_items.map(item => {
                          const unitPrice = Number((item as any).unit_price) || 0;
                          const packs = Number((item as any).packs) || 1;
                          const subtotal = Number(item.quantity) * unitPrice * packs;
                          
                          return (
                            <div key={item.id} className="flex justify-between items-center text-sm bg-muted/50 rounded px-2 py-1">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{item.custom_item_name || item.vegetable?.name}</span>
                                <span className="text-muted-foreground">
                                  ×{item.quantity}{item.unit}
                                  {packs > 1 && ` ×${packs}份`}
                                </span>
                              </div>
                              {hasPrices && unitPrice > 0 && (
                                <span className="text-primary font-medium">${subtotal.toLocaleString()}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Order total - only show if prices applied */}
                    {hasPrices && (
                      <div className="mt-3 pt-2 border-t border-border text-right">
                        <span className={`font-bold ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          小計: ${orderTotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    {/* Note if exists */}
                    {order.note && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        備註：{order.note}
                      </div>
                    )}

                    {/* Merchant note */}
                    {(order as any).merchant_note && (
                      <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                          <Store className="h-3 w-3" />
                          商家備註
                        </div>
                        <p className="text-sm text-blue-800 dark:text-blue-200">{(order as any).merchant_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
