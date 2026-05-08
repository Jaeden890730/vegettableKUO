import { useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrders } from '@/hooks/useOrders';
import { useVegetables } from '@/hooks/useVegetables';
import { useCustomers } from '@/hooks/useCustomers';
import { useSupplierOrders } from '@/hooks/useSupplierOrders';
import { Loader2, Package, ShoppingCart, Send, Printer, Tag, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
interface ItemDetail {
  quantity: number;
  packs: number;
  unit: string;
}

interface AggregatedItem {
  itemName: string;
  supplier: string; // 供貨商，無則為空字串
  details: ItemDetail[]; // 每筆訂單的明細
  totals: { unit: string; total: number }[]; // 按單位的總計
}

export default function AdminDailyStats() {
  const { orders, isLoading: ordersLoading } = useOrders({ isAdmin: true });
  const { vegetables, isLoading: vegetablesLoading } = useVegetables();
  const { customers, isLoading: customersLoading } = useCustomers();
  const { supplierOrders } = useSupplierOrders();

  const isLoading = ordersLoading || vegetablesLoading || customersLoading;
  const [isSending, setIsSending] = useState(false);
  const [isPrintingItems, setIsPrintingItems] = useState(false);
  const [isPrintingDetails, setIsPrintingDetails] = useState(false);
  const [isPrintingLabels, setIsPrintingLabels] = useState(false);
  const printItemsRef = useRef<HTMLDivElement>(null);
  const printDetailsRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // 預設出貨日期：當天 21:00 前 = 今天 (T)；21:00 後 = 明天 (T+1)
  const getDefaultDeliveryDate = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() >= 21) d.setDate(d.getDate() + 1);
    return d;
  };
  const [deliveryDate, setDeliveryDate] = useState<Date>(getDefaultDeliveryDate());
  const deliveryDateStr = format(deliveryDate, 'yyyy-MM-dd');

  // Filter "red light" orders (orders without prices applied) AND matching delivery date
  const newOrders = useMemo(() => {
    return orders.filter(order => {
      const hasPrice = order.order_items?.some(item => item.unit_price && item.unit_price > 0);
      if (hasPrice) return false;
      // 出貨日期篩選：以 delivery_date 為準，若無則 fallback 到 order_date
      const od = (order as any).delivery_date || order.order_date;
      return od === deliveryDateStr;
    });
  }, [orders, deliveryDateStr]);

  // Build vegetable lookup maps to resolve supplier
  const vegByIdMap = useMemo(() => {
    const m = new Map<string, typeof vegetables[number]>();
    vegetables.forEach(v => m.set(v.id, v));
    return m;
  }, [vegetables]);
  const vegByNameMap = useMemo(() => {
    const m = new Map<string, typeof vegetables[number]>();
    vegetables.forEach(v => m.set(v.name, v));
    return m;
  }, [vegetables]);

  const resolveSupplier = (item: { vegetable_id?: string | null; vegetable?: { name: string }; custom_item_name?: string | null }): string => {
    const veg = (item.vegetable_id && vegByIdMap.get(item.vegetable_id))
      || (item.vegetable?.name && vegByNameMap.get(item.vegetable.name))
      || (item.custom_item_name && vegByNameMap.get(item.custom_item_name));
    return (veg as any)?.supplier || '';
  };

  // Aggregate items by name, then by quantity+unit to merge packs
  const aggregatedItems = useMemo(() => {
    const itemMap = new Map<string, { 
      supplier: string;
      specMap: Map<string, { quantity: number; unit: string; totalPacks: number }>;
      unitTotals: Map<string, number>;
    }>();

    newOrders.forEach(order => {
      order.order_items?.forEach(item => {
        const itemName = item.vegetable?.name || item.custom_item_name || '未知品項';
        const unit = item.unit;
        const quantity = item.quantity;
        const packs = item.packs;
        const supplier = resolveSupplier(item as any);

        if (!itemMap.has(itemName)) {
          itemMap.set(itemName, { supplier, specMap: new Map(), unitTotals: new Map() });
        }

        const data = itemMap.get(itemName)!;
        if (!data.supplier && supplier) data.supplier = supplier;
        
        // 按 quantity+unit 合併份數
        const specKey = `${quantity}${unit}`;
        if (!data.specMap.has(specKey)) {
          data.specMap.set(specKey, { quantity, unit, totalPacks: 0 });
        }
        data.specMap.get(specKey)!.totalPacks += packs;
        
        // 計算單位總計
        const currentTotal = data.unitTotals.get(unit) || 0;
        data.unitTotals.set(unit, currentTotal + quantity * packs);
      });
    });

    // Convert to array and sort by supplier (empty last) then by item name
    const result: AggregatedItem[] = [];
    itemMap.forEach((data, itemName) => {
      const details: ItemDetail[] = [];
      data.specMap.forEach((spec) => {
        details.push({ quantity: spec.quantity, packs: spec.totalPacks, unit: spec.unit });
      });
      
      const totals: { unit: string; total: number }[] = [];
      data.unitTotals.forEach((total, unit) => {
        totals.push({ unit, total });
      });
      result.push({ itemName, supplier: data.supplier, details, totals });
    });

    const orderMap = new Map(supplierOrders.map((s) => [s.supplier_name, s.sort_order]));
    const maxOrder = supplierOrders.length;

    return result.sort((a, b) => {
      // Empty supplier sorts last
      if (!a.supplier && b.supplier) return 1;
      if (a.supplier && !b.supplier) return -1;
      const orderA = orderMap.get(a.supplier) ?? maxOrder;
      const orderB = orderMap.get(b.supplier) ?? maxOrder;
      if (orderA !== orderB) return orderA - orderB;
      const supCmp = a.supplier.localeCompare(b.supplier, 'zh-TW');
      if (supCmp !== 0) return supCmp;
      return a.itemName.localeCompare(b.itemName, 'zh-TW');
    });
  }, [newOrders, vegByIdMap, vegByNameMap, supplierOrders]);


  // Get customer name helper
  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || '未知客戶';
  };

  // Format item detail string (e.g., "3斤x2" or "5斤x1")
  const formatDetail = (detail: ItemDetail) => {
    return `${detail.quantity}${detail.unit}x${detail.packs}`;
  };

  // Send stats to Telegram
  const sendToTelegram = async () => {
    if (aggregatedItems.length === 0) {
      toast({ title: '沒有資料可發送', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      // 從資料庫讀取所有接收人
      const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .like('key', 'telegram_recipient_%');
      
      // 解析接收人 Chat ID
      const recipientMap = new Map<string, string>();
      settings?.forEach((setting) => {
        const match = setting.key.match(/telegram_recipient_(\d+)_chat_id/);
        if (match && setting.value) {
          recipientMap.set(match[1], setting.value);
        }
      });
      
      const chatIds = Array.from(recipientMap.values());
      
      if (chatIds.length === 0) {
        // 如果沒有設定接收人，使用環境變數的預設值
        const payload = {
          type: 'daily_stats',
          date: format(deliveryDate, 'yyyy/MM/dd EEEE', { locale: zhTW }),
          orderCount: newOrders.length,
          items: aggregatedItems.map(item => ({
            itemName: item.itemName,
            details: item.details.map(d => formatDetail(d)),
            total: item.totals.map(t => `${t.total}${t.unit}`).join('+'),
          })),
        };
        
        const { error } = await supabase.functions.invoke('notify-telegram', {
          body: payload,
        });
        
        if (error) throw error;
        toast({ title: '已發送到 Telegram' });
      } else {
        // 發送給所有接收人
        const payload = {
          type: 'daily_stats',
          date: format(deliveryDate, 'yyyy/MM/dd EEEE', { locale: zhTW }),
          orderCount: newOrders.length,
          items: aggregatedItems.map(item => ({
            itemName: item.itemName,
            details: item.details.map(d => formatDetail(d)),
            total: item.totals.map(t => `${t.total}${t.unit}`).join('+'),
          })),
        };
        
        const results = await Promise.all(
          chatIds.map(chatId => 
            supabase.functions.invoke('notify-telegram', {
              body: { ...payload, targetChatId: chatId },
            })
          )
        );
        
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error('Some notifications failed:', errors);
          toast({ 
            title: `已發送給 ${chatIds.length - errors.length}/${chatIds.length} 位接收人`,
            variant: errors.length === chatIds.length ? 'destructive' : 'default',
          });
        } else {
          toast({ title: `已發送給 ${chatIds.length} 位接收人` });
        }
      }
    } catch (err) {
      console.error('Failed to send to Telegram:', err);
      toast({ title: '發送失敗', description: '請稍後再試', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // Group orders by customer for printing
  const ordersByCustomer = useMemo(() => {
    const grouped = new Map<string, typeof newOrders>();
    newOrders.forEach(order => {
      const customerId = order.customer_id;
      if (!grouped.has(customerId)) {
        grouped.set(customerId, []);
      }
      grouped.get(customerId)!.push(order);
    });
    return grouped;
  }, [newOrders]);

  // Generate label data - one label per item per customer
  const labelItems = useMemo(() => {
    const labels: { customerName: string; itemName: string; spec: string }[] = [];
    newOrders.forEach(order => {
      const customerName = getCustomerName(order.customer_id);
      order.order_items?.forEach(item => {
        const itemName = item.vegetable?.name || item.custom_item_name || '未知品項';
        const spec = item.packs > 1 
          ? `${item.quantity}${item.unit}x${item.packs}`
          : `${item.quantity}${item.unit}`;
        labels.push({ customerName, itemName, spec });
      });
    });
    return labels;
  }, [newOrders, customers]);

  // Block-aware print helper: 以 ref 內 [data-print-block] 子元素為單位排版，避免單一區塊跨頁被切
  const printContent = async (
    ref: React.RefObject<HTMLDivElement>,
    setLoading: (v: boolean) => void,
    fileName: string,
    orientation: 'l' | 'p' = 'l'
  ) => {
    if (!ref.current) return;
    setLoading(true);
    try {
      const node = ref.current;
      node.style.display = 'block';

      const pdf = new jsPDF(orientation, 'mm', 'a5');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginX = 10;
      const marginY = 10;
      const blockGap = 2; // 區塊之間的小間距 (mm)
      const availableWidth = pdfWidth - marginX * 2;
      const availableHeight = pdfHeight - marginY * 2;

      // 取得所有要分頁排版的區塊；若沒有標記則退回整體 capture
      const blocks = Array.from(
        node.querySelectorAll<HTMLElement>('[data-print-block]')
      );

      const captureBlock = async (el: HTMLElement) => {
        const c = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const heightMm = (c.height / c.width) * availableWidth;
        return { dataUrl: c.toDataURL('image/png'), heightMm };
      };

      if (blocks.length === 0) {
        // Fallback: 整體 capture（同舊行為，內容過長會以裁切方式分頁）
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const renderWidth = availableWidth;
        const renderHeight = (canvas.height / canvas.width) * renderWidth;
        if (renderHeight <= availableHeight) {
          pdf.addImage(imgData, 'PNG', marginX, marginY, renderWidth, renderHeight);
        } else {
          let renderedHeight = 0;
          let pageIndex = 0;
          while (renderedHeight < renderHeight) {
            if (pageIndex > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', marginX, marginY - renderedHeight, renderWidth, renderHeight);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pdfWidth, marginY, 'F');
            pdf.rect(0, marginY + availableHeight, pdfWidth, pdfHeight, 'F');
            renderedHeight += availableHeight;
            pageIndex++;
          }
        }
      } else {
        // 逐區塊 capture，再依高度組裝到頁面，避免單一區塊被跨頁切割
        const captured = [] as { dataUrl: string; heightMm: number }[];
        for (const el of blocks) {
          captured.push(await captureBlock(el));
        }

        let cursorY = marginY;
        let isFirstPage = true;

        for (const item of captured) {
          let h = item.heightMm;
          // 若單一區塊比整頁還高（極端情況），則只能允許切割：以裁切方式分頁
          if (h > availableHeight) {
            if (!isFirstPage && cursorY > marginY) {
              pdf.addPage();
              cursorY = marginY;
            }
            let renderedHeight = 0;
            while (renderedHeight < h) {
              if (renderedHeight > 0) {
                pdf.addPage();
                cursorY = marginY;
              }
              pdf.addImage(
                item.dataUrl,
                'PNG',
                marginX,
                cursorY - renderedHeight,
                availableWidth,
                h
              );
              pdf.setFillColor(255, 255, 255);
              pdf.rect(0, 0, pdfWidth, marginY, 'F');
              pdf.rect(0, marginY + availableHeight, pdfWidth, pdfHeight, 'F');
              renderedHeight += availableHeight;
            }
            cursorY = marginY + availableHeight + 1; // 強制下一個區塊換頁
            isFirstPage = false;
            continue;
          }

          // 一般情況：放不下就換頁
          if (cursorY + h > marginY + availableHeight) {
            pdf.addPage();
            cursorY = marginY;
          }
          pdf.addImage(item.dataUrl, 'PNG', marginX, cursorY, availableWidth, h);
          cursorY += h + blockGap;
          isFirstPage = false;
        }
      }

      node.style.display = 'none';
      pdf.save(`${fileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: '已產生 PDF' });
    } catch (err) {
      console.error('Print failed:', err);
      toast({ title: '列印失敗', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintItems = () => printContent(printItemsRef, setIsPrintingItems, '品項總量', 'p');
  const handlePrintDetails = () => printContent(printDetailsRef, setIsPrintingDetails, '訂單明細');

  // Print labels - supports multiple pages (40 labels per page)
  const handlePrintLabels = async () => {
    if (!labelRef.current || labelItems.length === 0) return;
    
    setIsPrintingLabels(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const labelsPerPage = 40;
      const totalPages = Math.ceil(labelItems.length / labelsPerPage);
      
      for (let page = 0; page < totalPages; page++) {
        // Update the label content for this page
        const startIdx = page * labelsPerPage;
        const pageLabels = labelItems.slice(startIdx, startIdx + labelsPerPage);
        
        // Create a temporary container for this page
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          width: 794px;
          height: 1123px;
          background-color: #ffffff;
          font-family: sans-serif;
          padding: 0;
          margin: 0;
        `;
        
        tempContainer.innerHTML = `
          <div style="
            display: grid;
            grid-template-columns: repeat(4, 198.5px);
            grid-template-rows: repeat(10, 112.3px);
            gap: 0;
            width: 100%;
            height: 100%;
          ">
            ${pageLabels.map(label => `
              <div style="
                padding: 4px 8px;
                text-align: center;
                background-color: #fff;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                overflow: hidden;
              ">
                <div style="
                  font-size: 14px;
                  font-weight: bold;
                  margin-bottom: 4px;
                  color: #000;
                  line-height: 1.2;
                ">${label.customerName}</div>
                <div style="
                  font-size: 13px;
                  color: #000;
                  line-height: 1.2;
                ">${label.itemName} ${label.spec}</div>
              </div>
            `).join('')}
          </div>
        `;
        
        document.body.appendChild(tempContainer);
        
        const canvas = await html2canvas(tempContainer, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        
        document.body.removeChild(tempContainer);
        
        if (page > 0) {
          pdf.addPage();
        }
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`標籤貼紙_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: `已產生標籤 PDF (${labelItems.length} 個標籤)` });
    } catch (err) {
      console.error('Print labels failed:', err);
      toast({ title: '列印失敗', variant: 'destructive' });
    } finally {
      setIsPrintingLabels(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">當日統計</h2>
          <p className="text-sm text-muted-foreground">
            統計指定出貨日的新訂單（紅燈）品項總量，方便備貨
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">出貨日</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(deliveryDate, 'yyyy/MM/dd EEEE', { locale: zhTW })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={deliveryDate}
                onSelect={(d) => d && setDeliveryDate(d)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => setDeliveryDate(getDefaultDeliveryDate())}>
            重設
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{newOrders.length}</p>
                <p className="text-xs text-muted-foreground">待處理訂單</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregatedItems.length}</p>
                <p className="text-xs text-muted-foreground">品項種類</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregated Items */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">品項總量統計</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrintLabels}
              disabled={isPrintingLabels || labelItems.length === 0}
            >
              {isPrintingLabels ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Tag className="h-4 w-4" />
              )}
              <span className="ml-1.5">標籤</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrintItems}
              disabled={isPrintingItems || aggregatedItems.length === 0}
            >
              {isPrintingItems ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span className="ml-1.5">列印</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={sendToTelegram}
              disabled={isSending || aggregatedItems.length === 0}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-1.5">發送</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aggregatedItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              目前沒有待處理的訂單
            </p>
          ) : (
            <div className="space-y-0">
              {aggregatedItems.map((item) => (
                <div
                  key={item.itemName}
                  className="py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium text-foreground whitespace-nowrap">{item.itemName}</span>
                    <div className="flex-1 flex flex-wrap gap-1.5 justify-end">
                      {item.details.map((d, i) => (
                        <span
                          key={i}
                          className="text-sm px-2 py-0.5 bg-muted rounded text-muted-foreground"
                        >
                          {formatDetail(d)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1 text-right">
                    <span className="text-sm font-medium text-primary">
                      總計 {item.totals.map((t, i) => (
                        <span key={t.unit}>
                          {t.total}{t.unit}
                          {i < item.totals.length - 1 && '+'}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">訂單明細</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintDetails}
            disabled={isPrintingDetails || newOrders.length === 0}
          >
            {isPrintingDetails ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            <span className="ml-1.5">列印</span>
          </Button>
        </CardHeader>
        <CardContent>
          {newOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              目前沒有待處理的訂單
            </p>
          ) : (
            <div className="space-y-4">
              {newOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 bg-destructive rounded-full" />
                    <span className="font-medium">{getCustomerName(order.customer_id)}</span>
                    <span className="text-sm text-muted-foreground">({order.order_number})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {order.order_items?.map((item) => (
                      <span
                        key={item.id}
                        className="text-sm px-2 py-0.5 bg-background rounded"
                      >
                        {item.vegetable?.name || item.custom_item_name}{' '}
                        {item.packs > 1 
                          ? `${item.quantity}${item.unit}x${item.packs}`
                          : `${item.quantity}${item.unit}`
                        }
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden Print Content - 品項總量 only */}
      <div
        ref={printItemsRef}
        style={{
          display: 'none',
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '880px',
          padding: '16px 20px 20px 20px',
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div data-print-block>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', color: '#000' }}>
            <span>{format(deliveryDate, 'yyyy年MM月dd日 EEEE', { locale: zhTW })}</span>
            <span>待處理訂單：<span style={{ fontWeight: 'bold' }}>{newOrders.length}</span> 筆</span>
          </div>
          <div style={{ display: 'flex', backgroundColor: '#ddd', fontSize: '22px', borderBottom: '1px solid #999' }}>
            <div style={{ width: '25%', padding: '8px 10px', fontWeight: 'bold', color: '#000', boxSizing: 'border-box' }}>品項</div>
            <div style={{ flex: 1, padding: '8px 10px', fontWeight: 'bold', color: '#000', boxSizing: 'border-box' }}>規格明細</div>
            <div style={{ width: '20%', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#000', boxSizing: 'border-box' }}>總計</div>
          </div>
        </div>

        {aggregatedItems.map((item, idx) => (
          <div
            key={item.itemName}
            data-print-block
            style={{
              display: 'flex',
              fontSize: '22px',
              backgroundColor: idx % 2 === 0 ? '#fff' : '#f5f5f5',
              borderBottom: '1px solid #ddd',
            }}
          >
            <div style={{ width: '25%', padding: '10px', fontWeight: 500, color: '#000', boxSizing: 'border-box' }}>{item.itemName}</div>
            <div style={{ flex: 1, padding: '10px', color: '#333', boxSizing: 'border-box' }}>
              {item.details.map(d => formatDetail(d)).join(' ｜ ')}
            </div>
            <div style={{ width: '20%', padding: '10px', textAlign: 'right', fontWeight: 500, color: '#000', boxSizing: 'border-box' }}>
              {item.totals.map((t, i) => `${t.total}${t.unit}${i < item.totals.length - 1 ? '+' : ''}`).join('')}
            </div>
          </div>
        ))}
      </div>

      {/* Hidden Print Content - 訂單明細 only */}
      <div
        ref={printDetailsRef}
        style={{
          display: 'none',
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '880px',
          padding: '16px 20px 20px 20px',
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div data-print-block style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', color: '#000' }}>
          <span>{format(deliveryDate, 'yyyy年MM月dd日 EEEE', { locale: zhTW })}</span>
          <span>待處理訂單：<span style={{ fontWeight: 'bold' }}>{newOrders.length}</span> 筆</span>
        </div>

        <div>
          {Array.from(ordersByCustomer.entries()).map(([customerId, customerOrders]) => (
            <div key={customerId} data-print-block style={{ marginBottom: '14px', border: '1px solid #999', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', backgroundColor: '#ddd', borderBottom: '1px solid #999' }}>
                <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#000' }}>{getCustomerName(customerId)}</span>
                <span style={{ marginLeft: '10px', fontSize: '14px', color: '#333' }}>({customerOrders.length} 筆訂單)</span>
              </div>
              <div style={{ padding: '12px' }}>
                {customerOrders.map((order, orderIdx) => (
                  <div key={order.id} style={{
                    marginBottom: orderIdx < customerOrders.length - 1 ? '8px' : '0',
                    paddingBottom: orderIdx < customerOrders.length - 1 ? '8px' : '0',
                    borderBottom: orderIdx < customerOrders.length - 1 ? '1px dashed #ccc' : 'none'
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                      {order.order_number}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {order.order_items?.map((item) => (
                        <span
                          key={item.id}
                          style={{
                            fontSize: '15px',
                            padding: '4px 8px',
                            backgroundColor: '#eee',
                            border: '1px solid #ccc',
                            color: '#000',
                          }}
                        >
                          {item.vegetable?.name || item.custom_item_name}{' '}
                          {item.packs > 1
                            ? `${item.quantity}${item.unit}x${item.packs}`
                            : `${item.quantity}${item.unit}`
                          }
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden Label Print Content - 52.5mm x 29.7mm labels, 4x10 per A4 */}
      <div
        ref={labelRef}
        style={{
          display: 'none',
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '794px', // A4 width at 96 DPI (210mm)
          height: '1123px', // A4 height at 96 DPI (297mm)
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
          padding: 0,
          margin: 0,
        }}
      >
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 198.5px)', // 52.5mm ≈ 198.5px at 96 DPI
          gridTemplateRows: 'repeat(10, 112.3px)', // 29.7mm ≈ 112.3px at 96 DPI
          gap: '0',
          width: '100%',
          height: '100%',
        }}>
          {labelItems.slice(0, 40).map((label, idx) => (
            <div
              key={idx}
              style={{
                padding: '4px 8px',
                textAlign: 'center',
                backgroundColor: '#fff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginBottom: '4px',
                color: '#000',
                lineHeight: '1.2',
              }}>
                {label.customerName}
              </div>
              <div style={{ 
                fontSize: '13px',
                color: '#000',
                lineHeight: '1.2',
              }}>
                {label.itemName} {label.spec}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
