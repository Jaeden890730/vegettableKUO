import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, Loader2, Check, ChevronDown, History } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useVegetables } from '@/hooks/useVegetables';
import { useOrders } from '@/hooks/useOrders';
import { useCustomerOrderFrequency } from '@/hooks/useCustomerOrderFrequency';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface OrderItemInput {
  id: string;
  vegetable_id?: string;
  custom_item_name?: string;
  name: string;
  quantity: number;
  unit: string;
  packs: number; // 份數/包數
}

export default function CustomerOrder() {
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer, customerId, customerName, isLoading: authLoading, signOut } = useSupabaseAuth();
  const { visibleVegetables, isLoading: vegsLoading } = useVegetables(false);
  const { createOrder } = useOrders({ customerId, isAdmin: false });
  const { sortByFrequency, isLoading: freqLoading } = useCustomerOrderFrequency(customerId);

  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [submittedItems, setSubmittedItems] = useState<OrderItemInput[]>([]);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemUnit, setCustomItemUnit] = useState('斤');
  const [isVegetablesOpen, setIsVegetablesOpen] = useState(true);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isCustomer)) {
      navigate('/customer-auth');
    }
  }, [isAuthenticated, isCustomer, authLoading, navigate]);

  const handleAddVegetable = (vegetable: { id: string; name: string; unit: string }) => {
    // Always add as new line to allow multiple entries of same item
    setOrderItems(prev => [...prev, {
      id: crypto.randomUUID(),
      vegetable_id: vegetable.id,
      name: vegetable.name,
      quantity: 1,
      unit: vegetable.unit,
      packs: 1,
    }]);
    toast.success(`已加入 ${vegetable.name} (${vegetable.unit})`);
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) {
      toast.error('請輸入品項名稱');
      return;
    }
    setOrderItems(prev => [...prev, {
      id: crypto.randomUUID(),
      custom_item_name: customItemName,
      name: customItemName,
      quantity: customItemQty,
      unit: customItemUnit,
      packs: 1,
    }]);
    toast.success(`已加入 ${customItemName}`);
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemUnit('斤');
  };

  const handleSetPacks = (id: string, packs: number) => {
    const newPacks = Math.max(1, Math.round(packs));
    setOrderItems(prev => prev.map(item => 
      item.id === id ? { ...item, packs: newPacks } : item
    ));
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0.5, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleSetQuantity = (id: string, value: number) => {
    const newQty = Math.max(0.5, value);
    setOrderItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: newQty } : item
    ));
  };

  const handleSetUnit = (id: string, unit: string) => {
    setOrderItems(prev => prev.map(item => 
      item.id === id ? { ...item, unit } : item
    ));
  };

  const handleRemoveItem = (id: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error('無法取得客戶資料');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('請至少選擇一個品項');
      return;
    }

    setIsSubmitting(true);
    try {
      const { order, error } = await createOrder({
        customer_id: customerId,
        note: note || undefined,
        items: orderItems.map(item => ({
          vegetable_id: item.vegetable_id,
          custom_item_name: item.custom_item_name,
          quantity: item.quantity,
          unit: item.unit,
          packs: item.packs,
        })),
      });

      if (error) throw error;

      // Send Telegram notification (non-blocking)
      const orderTime = new Date().toLocaleString('zh-TW', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      supabase.functions.invoke('notify-telegram', {
        body: {
          orderNumber: order?.order_number || '',
          customerName: customerName || '未知客戶',
          items: orderItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            packs: item.packs,
          })),
          note: note || undefined,
          orderTime,
        }
      }).catch(err => console.error('Telegram notification error:', err));

      setOrderNumber(order?.order_number || '');
      setSubmittedItems([...orderItems]); // Save submitted items for summary
      setShowSuccess(true);
      setOrderItems([]);
      setNote('');
    } catch (error) {
      console.error('Order error:', error);
      toast.error('下單失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Group vegetables by in_stock status and sort by customer's order frequency
  // IMPORTANT: useMemo must be called before any early returns
  const inStockVegs = useMemo(() => {
    const filtered = visibleVegetables.filter(v => v.status === 'in_stock');
    return sortByFrequency(filtered);
  }, [visibleVegetables, sortByFrequency]);

  if (authLoading || vegsLoading || freqLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Card className="mx-auto max-w-md">
            <CardContent className="pt-8">
              <div className="text-center mb-6">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-foreground">訂單已送出！</h2>
                <p className="text-muted-foreground">
                  訂單編號：<span className="font-mono font-bold">{orderNumber}</span>
                </p>
              </div>
              
              {/* Order Summary */}
              {submittedItems.length > 0 && (
                <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="font-medium text-foreground mb-3">訂單摘要</h3>
                  <div className="space-y-1.5">
                    {submittedItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-foreground">{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.quantity} {item.unit} {item.packs > 1 ? `× ${item.packs}份` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border text-sm text-muted-foreground">
                    共 {submittedItems.length} 項品項
                  </div>
                </div>
              )}

              <p className="mb-6 text-sm text-center text-muted-foreground">
                我們將確認後出貨/備貨，謝謝您的訂購！
              </p>
              <div className="space-y-2">
                <Button onClick={() => setShowSuccess(false)} className="w-full">
                  繼續下單
                </Button>
                <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                  返回首頁
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
              返回
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold">下單訂購</h1>
              {customerName && (
                <span className="text-sm text-primary-foreground/80">{customerName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/order-history')}
                className="flex items-center gap-1 text-sm text-primary-foreground/80 hover:text-primary-foreground"
                title="歷史訂單"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-4 space-y-4">
        {/* Price disclaimer */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
            ⚠️ 目前顯示價格為當下價格，實際價格以出貨日為準
          </p>
        </div>

        {/* Vegetable selection */}
        <Collapsible open={isVegetablesOpen} onOpenChange={setIsVegetablesOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">選擇蔬菜品項</CardTitle>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isVegetablesOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {inStockVegs.map((veg) => {
                    const prices = veg.prices && veg.prices.length > 0 
                      ? veg.prices 
                      : [{ id: veg.id, price: veg.price, unit: veg.unit }];
                    
                    // Single price - simple button
                    if (prices.length === 1) {
                      return (
                        <button
                          key={veg.id}
                          onClick={() => handleAddVegetable({ id: veg.id, name: veg.name, unit: prices[0].unit })}
                          className="flex flex-col items-center rounded-lg border border-border p-3 hover:bg-muted/50 active:scale-95 transition-all"
                        >
                          <span className="font-medium text-foreground">{veg.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ${prices[0].price}/{prices[0].unit}
                          </span>
                        </button>
                      );
                    }
                    
                    // Multiple prices - dropdown
                    return (
                      <Popover key={veg.id}>
                        <PopoverTrigger asChild>
                          <button className="flex flex-col items-center rounded-lg border border-border p-3 hover:bg-muted/50 transition-all">
                            <span className="font-medium text-foreground">{veg.name}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {prices.length}種規格 <ChevronDown className="h-3 w-3" />
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="center">
                          <div className="space-y-1">
                            {prices.map((priceOption, index) => (
                              <button
                                key={priceOption.id || index}
                                onClick={() => handleAddVegetable({ id: veg.id, name: veg.name, unit: priceOption.unit })}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors"
                              >
                                <span className="font-medium">${priceOption.price}</span>
                                <span className="text-muted-foreground">/{priceOption.unit}</span>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Custom item */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">其他品項（自填）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="品項名稱"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="數量"
                value={customItemQty}
                onChange={(e) => setCustomItemQty(Number(e.target.value) || 1)}
                className="w-24"
                min={0.5}
                step={0.5}
              />
              <Input
                placeholder="單位"
                value={customItemUnit}
                onChange={(e) => setCustomItemUnit(e.target.value)}
                className="w-20"
              />
              <Button onClick={handleAddCustomItem} size="sm" className="shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                加入
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Middle price disclaimer */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2">
          <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
            ⚠️ 目前顯示價格為當下價格，實際價格以出貨日為準
          </p>
        </div>

        {/* Order items */}
        {orderItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                訂購清單
                <span className="ml-2 text-xs font-normal text-muted-foreground">單位可以自行調整</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {orderItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-medium text-foreground text-sm truncate">{item.name}</span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-6 w-6 rounded text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Quantity: - input + */}
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted shrink-0"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleSetQuantity(item.id, Number(e.target.value) || 0.5)}
                      onFocus={(e) => e.target.select()}
                      className="w-12 h-7 text-center px-1 text-sm"
                      min={0.5}
                      step={0.5}
                    />
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    {/* Unit dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="min-w-8 px-1.5 h-7 text-center text-xs text-muted-foreground border border-border rounded hover:bg-muted flex items-center justify-center gap-0.5 shrink-0">
                          {item.unit}
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-28 p-1" align="center">
                        <div className="space-y-0.5">
                          {['斤', '條', '顆', '把', '箱', '件', '公斤'].map((unitOption) => (
                            <button
                              key={unitOption}
                              onClick={() => handleSetUnit(item.id, unitOption)}
                              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                item.unit === unitOption ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                              }`}
                            >
                              {unitOption}
                            </button>
                          ))}
                          <div className="border-t border-border pt-1 mt-1">
                            <Input
                              placeholder="自訂"
                              className="h-6 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const value = (e.target as HTMLInputElement).value.trim();
                                  if (value) handleSetUnit(item.id, value);
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value) handleSetUnit(item.id, value);
                              }}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {/* Packs: x - input + 份 */}
                    <span className="text-xs text-muted-foreground">×</span>
                    <button
                      onClick={() => handleSetPacks(item.id, item.packs - 1)}
                      className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted shrink-0"
                      disabled={item.packs <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      type="number"
                      value={item.packs}
                      onChange={(e) => handleSetPacks(item.id, Number(e.target.value) || 1)}
                      onFocus={(e) => e.target.select()}
                      className="w-10 h-7 text-center px-1 text-sm"
                      min={1}
                      step={1}
                    />
                    <button
                      onClick={() => handleSetPacks(item.id, item.packs + 1)}
                      className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-muted-foreground">份</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Order details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">訂單備註</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm text-muted-foreground">備註（選填）</label>
              <Textarea
                placeholder="有什麼需要特別說明的嗎？"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bottom price disclaimer */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 mb-4">
          <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
            ⚠️ 目前顯示價格為當下價格，實際價格以出貨日為準
          </p>
        </div>
      </main>

      {/* Fixed bottom submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg">
        <div className="container">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || orderItems.length === 0}
            className="w-full h-12 text-base"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <ShoppingCart className="h-5 w-5 mr-2" />
            )}
            送出訂單（{orderItems.length} 項）
          </Button>
        </div>
      </div>
    </div>
  );
}
