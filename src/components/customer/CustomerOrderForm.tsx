import { useState, useMemo } from 'react';
import { Plus, Minus, Trash2, Check, ChevronDown, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useVegetables } from '@/hooks/useVegetables';
import { useOrders } from '@/hooks/useOrders';
import { useCustomerOrderFrequency } from '@/hooks/useCustomerOrderFrequency';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WheelNumberInput } from '@/components/ui/wheel-number-input';
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
  packs: number;
}

interface Props {
  customerId: string | null;
  customerName: string | null;
}

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function CustomerOrderForm({ customerId, customerName }: Props) {
  const { vegetables, visibleVegetables, isLoading: vegsLoading } = useVegetables(false);
  const { createOrder } = useOrders({ customerId, isAdmin: false });
  const { sortByFrequency } = useCustomerOrderFrequency(customerId);

  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([]);
  const [note, setNote] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<string>(getTomorrow());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [submittedItems, setSubmittedItems] = useState<OrderItemInput[]>([]);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemUnit, setCustomItemUnit] = useState('斤');
  const [isVegetablesOpen, setIsVegetablesOpen] = useState(true);
  const [isPreorderOpen, setIsPreorderOpen] = useState(false);

  const inStockVegs = useMemo(() => {
    const filtered = visibleVegetables.filter(v => v.status === 'in_stock' && v.tag !== '預購');
    return sortByFrequency(filtered);
  }, [visibleVegetables, sortByFrequency]);

  const preorderVegs = useMemo(() => {
    const filtered = vegetables.filter(v => v.tag === '預購');
    return sortByFrequency(filtered);
  }, [vegetables, sortByFrequency]);

  const handleAddVegetable = (vegetable: { id: string; name: string; unit: string }) => {
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
        delivery_date: deliveryDate || undefined,
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

      // Send Telegram notification to all recipients
      // The edge function will handle fetching all recipients from database
      const orderTime = new Date().toLocaleString('zh-TW', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      
      (async () => {
        try {
          const payload = {
            type: 'order' as const,
            orderNumber: order?.order_number || '',
            customerName: customerName || '未知客戶',
            items: orderItems.map(item => ({
              name: item.name, quantity: item.quantity, unit: item.unit, packs: item.packs,
            })),
            note: note || undefined,
            orderTime,
            // Don't specify targetChatId - let edge function fetch all recipients
          };
          
          await supabase.functions.invoke('notify-telegram', { body: payload });
        } catch (err) {
          console.error('Telegram notification error:', err);
        }
      })();

      setOrderNumber(order?.order_number || '');
      setSubmittedItems([...orderItems]);
      setShowSuccess(true);
      setOrderItems([]);
      setNote('');
      setDeliveryDate(getTomorrow());
    } catch (error) {
      console.error('Order error:', error);
      toast.error('下單失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
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
            </div>
          )}

          <Button onClick={() => setShowSuccess(false)} className="w-full">
            繼續下單
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-32">
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

      {/* Pre-order section */}
      {preorderVegs.length > 0 && (
        <Collapsible open={isPreorderOpen} onOpenChange={setIsPreorderOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base">預購品項</CardTitle>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isPreorderOpen ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-xs text-blue-600 mt-1">前一天中午 12:00 前叫貨才有</p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {preorderVegs.map((veg) => {
                    const prices = veg.prices && veg.prices.length > 0 
                      ? veg.prices 
                      : [{ id: veg.id, price: veg.price, unit: veg.unit }];
                    
                    if (prices.length === 1) {
                      return (
                        <button
                          key={veg.id}
                          onClick={() => handleAddVegetable({ id: veg.id, name: veg.name, unit: prices[0].unit })}
                          className="flex flex-col items-center rounded-lg border border-blue-200 dark:border-blue-800 p-3 hover:bg-blue-50 dark:hover:bg-blue-950 active:scale-95 transition-all"
                        >
                          <span className="font-medium text-foreground">{veg.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ${prices[0].price}/{prices[0].unit}
                          </span>
                        </button>
                      );
                    }
                    
                    return (
                      <Popover key={veg.id}>
                        <PopoverTrigger asChild>
                          <button className="flex flex-col items-center rounded-lg border border-blue-200 dark:border-blue-800 p-3 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all">
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
      )}

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
            <WheelNumberInput
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

      {/* Order items */}
      {orderItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">訂購清單</CardTitle>
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
                  <button
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted shrink-0"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <WheelNumberInput
                    value={item.quantity}
                    onChange={(e) => handleSetQuantity(item.id, Number(e.target.value))}
                    className="w-14 h-7 text-center text-sm px-1"
                    min={0.5}
                    step={0.5}
                  />
                  <button
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <Input
                    value={item.unit}
                    onChange={(e) => handleSetUnit(item.id, e.target.value)}
                    className="w-12 h-7 text-center text-sm px-1"
                  />
                  <span className="text-xs text-muted-foreground mx-1">×</span>
                  <WheelNumberInput
                    value={item.packs}
                    onChange={(e) => handleSetPacks(item.id, Number(e.target.value))}
                    className="w-12 h-7 text-center text-sm px-1"
                    min={1}
                  />
                  <span className="text-xs text-muted-foreground">份</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Delivery date */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">出貨日期</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">預設為明天，可自行調整</p>
        </CardContent>
      </Card>

      {/* Note */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">備註</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="有什麼要特別備註的嗎？"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      {orderItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-12 text-lg"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                送出中...
              </>
            ) : (
              <>
                送出訂單（{orderItems.length} 項）
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
