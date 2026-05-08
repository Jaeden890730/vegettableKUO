import { useState, useRef } from 'react';
import { useSettlements } from '@/hooks/useSettlements';
import { useCustomers } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, DollarSign, Printer, FileSpreadsheet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface Props {
  customerFilter?: string;
  onCustomerFilterChange?: (v: string) => void;
}

export default function AdminSettlements({ customerFilter: externalFilter, onCustomerFilterChange }: Props = {}) {
  const { settlements, createSettlement, updateSettlement, deleteSettlement, updateSettlementItem, addSettlementItem, deleteSettlementItem, addPayment } = useSettlements({ isAdmin: true });
  const { customers } = useCustomers();

  // 計算總金額（subtotal 已經是四捨五入後的值）
  const calculateRoundedTotal = (settlement: typeof settlements[0]) => {
    return (settlement.settlement_items || []).reduce((sum, item) => {
      return sum + Number(item.subtotal);
    }, 0);
  };
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState<string | null>(null);
  
  // Create form
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  
  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check' | 'other'>('cash');

  // Customer filter
  const [internalFilter, setInternalFilter] = useState<string>('all');
  const customerFilter = externalFilter !== undefined ? externalFilter : internalFilter;
  const setCustomerFilter = (v: string) => {
    if (onCustomerFilterChange) onCustomerFilterChange(v);
    else setInternalFilter(v);
  };
  const filteredSettlements = customerFilter === 'all'
    ? settlements
    : settlements.filter(s => s.customer_id === customerFilter);

  const handleCreate = async () => {
    if (!newCustomerId || !newPeriodStart || !newPeriodEnd) {
      toast.error('請填寫完整資料');
      return;
    }
    const { error } = await createSettlement({
      customer_id: newCustomerId,
      period_start: newPeriodStart,
      period_end: newPeriodEnd,
    });
    if (error) {
      toast.error('建立失敗');
    } else {
      toast.success('結帳單已建立');
      setShowCreateDialog(false);
      setNewCustomerId('');
      setNewPeriodStart('');
      setNewPeriodEnd('');
    }
  };


  const handleDeleteSettlement = async (id: string, settlementNumber: string) => {
    if (!confirm(`確定要刪除結帳單 ${settlementNumber} 嗎？`)) return;
    const { error } = await deleteSettlement(id);
    if (error) {
      toast.error('刪除失敗');
    } else {
      toast.success('結帳單已刪除');
    }
  };

  const handleAddPayment = async () => {
    if (!showPaymentDialog || !paymentAmount) return;
    const { error } = await addPayment({
      settlement_id: showPaymentDialog,
      payment_date: paymentDate,
      amount: Number(paymentAmount),
      payment_method: paymentMethod,
    });
    if (error) {
      toast.error('新增收款失敗');
    } else {
      toast.success('已新增收款');
      setShowPaymentDialog(null);
      setPaymentAmount('');
    }
  };

  const selectedSettlement = settlements.find(s => s.id === showDetailDialog);

  // Export to Excel
  const handleExportExcel = (settlement: typeof settlements[0]) => {
    // Group items by date
    const items = settlement.settlement_items || [];
    const rows: any[] = [];
    
    // Header info
    rows.push(['結帳單號', settlement.settlement_number]);
    rows.push(['客戶', settlement.customer?.name || '']);
    rows.push(['結帳區間', `${settlement.period_start} ~ ${settlement.period_end}`]);
    rows.push(['總金額', calculateRoundedTotal(settlement)]);
    rows.push([]);
    
    // Items header
    rows.push(['日期', '品項', '數量', '單位', '單價', '小計']);
    
    // Items
    items.forEach(item => {
      const orderDate = (item as any).order_date || '';
      const dateStr = orderDate ? format(parseISO(orderDate), 'M/d (EEEE)', { locale: zhTW }) : '';
      rows.push([
        dateStr,
        item.item_name,
        item.settlement_quantity,
        item.settlement_unit,
        item.settlement_unit_price,
        Number(item.subtotal)
      ]);
    });
    
    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '結帳單');
    
    // Download
    XLSX.writeFile(wb, `結帳單_${settlement.settlement_number}.xlsx`);
    toast.success('Excel 匯出成功');
  };

  // Print / Export PDF
  const handlePrint = (settlement: typeof settlements[0], variant: 'standard' | 'receipt-stamp' = 'standard') => {
    // Group items by date
    const grouped = (settlement.settlement_items || []).reduce((acc, item) => {
      const date = (item as any).order_date || '未知日期';
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }, {} as Record<string, typeof settlement.settlement_items>);
    
    const itemsHtml = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => {
        const dateStr = date !== '未知日期' ? format(parseISO(date), 'M/d (EEEE)', { locale: zhTW }) : date;
        const itemsRows = items?.map(item => `
          <tr>
            <td style="padding: 4px 8px;">${item.item_name}</td>
            <td style="padding: 4px 8px; text-align: right;">${item.settlement_quantity} ${item.settlement_unit}</td>
            <td style="padding: 4px 8px; text-align: right;">$${item.settlement_unit_price}</td>
            <td style="padding: 4px 8px; text-align: right;">$${Number(item.subtotal).toLocaleString()}</td>
          </tr>
        `).join('');
        return `
          <tr style="background: #f5f5f5;">
            <td colspan="4" style="padding: 6px 8px; font-weight: bold;">${dateStr}</td>
          </tr>
          ${itemsRows}
        `;
      }).join('');

    const total = calculateRoundedTotal(settlement).toLocaleString();
    const isReceiptStamp = variant === 'receipt-stamp';

    if (isReceiptStamp) {
      // ============ 正式收據版（A5 滿版分頁，章區固定 footer，自動補空白列）============
      // 1) 將明細扁平化成 row 陣列，包含日期分組列
      type Row =
        | { kind: 'group'; date: string }
        | { kind: 'item'; name: string; qty: string | number; unit: string; price: number; subtotal: number };
      const rows: Row[] = [];
      Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, items]) => {
          const dateStr = date !== '未知日期'
            ? format(parseISO(date), 'M/d (EEEE)', { locale: zhTW })
            : date;
          rows.push({ kind: 'group', date: dateStr });
          (items || []).forEach(it => rows.push({
            kind: 'item',
            name: it.item_name,
            qty: it.settlement_quantity,
            unit: it.settlement_unit,
            price: Number(it.settlement_unit_price),
            subtotal: Number(it.subtotal),
          }));
        });

      // 2) 每頁可容納列數（A5 直 148x210mm，扣 header/footer 後表格區約 110mm，
      //    每列 6mm 高 → 約 18 列；最後一頁要保留總計 + 備註空間 → 14 列）
      const ROWS_PER_PAGE = 18;
      const ROWS_LAST_PAGE = 13;

      // 3) 切片成多頁
      const pages: Row[][] = [];
      let i = 0;
      while (i < rows.length) {
        const remaining = rows.length - i;
        // 嘗試假設此頁是最後一頁
        if (remaining <= ROWS_LAST_PAGE) {
          pages.push(rows.slice(i, i + remaining));
          i += remaining;
        } else {
          pages.push(rows.slice(i, i + ROWS_PER_PAGE));
          i += ROWS_PER_PAGE;
        }
      }
      if (pages.length === 0) pages.push([]);

      // 4) 補空白列讓表格撐滿
      const renderRow = (r: Row | null) => {
        if (!r) {
          return `<tr class="empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`;
        }
        if (r.kind === 'group') {
          return `<tr class="group-row"><td colspan="5">${r.date}</td></tr>`;
        }
        return `
          <tr>
            <td class="name">${r.name}</td>
            <td class="num">${r.qty}</td>
            <td class="unit">${r.unit}</td>
            <td class="num">$${r.price}</td>
            <td class="num">$${r.subtotal.toLocaleString()}</td>
          </tr>
        `;
      };

      const todayStr = format(new Date(), 'yyyy/MM/dd');
      const totalPages = pages.length;

      const pagesHtml = pages.map((pageRows, idx) => {
        const isLast = idx === totalPages - 1;
        const capacity = isLast ? ROWS_LAST_PAGE : ROWS_PER_PAGE;
        const padCount = Math.max(0, capacity - pageRows.length);
        const filledRows = [
          ...pageRows.map(r => renderRow(r)),
          ...Array.from({ length: padCount }).map(() => renderRow(null)),
        ].join('');

        return `
          <section class="sheet">
            <!-- HEADER -->
            <header class="sheet-header">
              <div class="title">免用統一發票收據</div>
              <div class="sub">
                <span>收據編號：${settlement.settlement_number}</span>
                <span>開立日期：${todayStr}</span>
              </div>
              <table class="meta">
                <tr>
                  <td class="meta-label">買受人名稱</td>
                  <td class="meta-value"></td>
                  <td class="meta-label">統一編號</td>
                  <td class="meta-value short"></td>
                </tr>
                <tr>
                  <td class="meta-label">結帳區間</td>
                  <td class="meta-value" colspan="3">${settlement.period_start} ～ ${settlement.period_end}</td>
                </tr>
              </table>
            </header>

            <!-- TABLE（flex-grow 撐滿） -->
            <main class="sheet-body">
              <table class="items">
                <thead>
                  <tr>
                    <th style="width: 38%;">品項</th>
                    <th style="width: 14%;">數量</th>
                    <th style="width: 14%;">單位</th>
                    <th style="width: 16%;">單價</th>
                    <th style="width: 18%;">小計</th>
                  </tr>
                </thead>
                <tbody>
                  ${filledRows}
                </tbody>
              </table>

              ${isLast ? `
                <div class="totals">
                  <div class="total-line">總金額　新台幣 <span class="total-num">$${total}</span> 元整</div>
                </div>
                <div class="notes">
                  <div class="notes-title">備註：</div>
                  <div>1. 價格依出貨日為準。</div>
                  <div>2. 本單據僅供收據使用。</div>
                </div>
              ` : ''}
            </main>

            <!-- FOOTER（章區 + 頁碼） -->
            <footer class="sheet-footer">
              <div class="sign-area">
                <div class="stamp-box"></div>
              </div>
              <div class="page-num">第 ${idx + 1} / ${totalPages} 頁</div>
            </footer>
          </section>
        `;
      }).join('');

      const receiptContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>免用統一發票收據 ${settlement.settlement_number}</title>
          <style>
            @page { size: A5 portrait; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #ddd; color: #000; }
            body {
              font-family: "Microsoft JhengHei", "PingFang TC", "Heiti TC", Arial, sans-serif;
              font-size: 9.5pt;
              line-height: 1.35;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* 每張 A5 紙 = 一個 .sheet，固定高度，flex 撐滿 */
            .sheet {
              width: 148mm;
              height: 210mm;
              padding: 7mm 9mm 7mm 9mm;
              background: #fff;
              display: flex;
              flex-direction: column;
              page-break-after: always;
              overflow: hidden;
            }
            .sheet:last-child { page-break-after: auto; }

            /* HEADER */
            .sheet-header { flex: 0 0 auto; }
            .sheet-header .title {
              text-align: center;
              font-size: 15pt;
              font-weight: bold;
              letter-spacing: 6px;
              padding-bottom: 1.5mm;
              border-bottom: 2px solid #000;
            }
            .sheet-header .sub {
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              padding: 1.2mm 1mm;
              border-bottom: 1px solid #000;
            }
            .meta { width: 100%; border-collapse: collapse; margin-top: 2mm; font-size: 9.5pt; }
            .meta td { padding: 1.2mm 1mm; vertical-align: middle; }
            .meta-label { width: 22mm; white-space: nowrap; }
            .meta-value { border-bottom: 1px solid #000; height: 5mm; }
            .meta-value.short { width: 30mm; }

            /* BODY（撐滿剩餘空間） */
            .sheet-body {
              flex: 1 1 auto;
              display: flex;
              flex-direction: column;
              margin-top: 2mm;
              min-height: 0;
            }

            /* 商品表 */
            table.items {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5pt;
              table-layout: fixed;
            }
            table.items th {
              border-top: 2px solid #000;
              border-bottom: 1px solid #000;
              padding: 1.5mm 1mm;
              font-weight: bold;
              text-align: center;
              background: #fff;
            }
            table.items td {
              border-bottom: 1px solid #000;
              padding: 0 1.5mm;
              height: 6mm;
              vertical-align: middle;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }
            table.items td.name { text-align: left; }
            table.items td.unit { text-align: center; }
            table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
            table.items tr.empty td { color: transparent; }
            table.items tr.group-row td {
              text-align: left;
              font-weight: bold;
              background: #fff;
              padding: 1mm 1.5mm;
            }

            /* 最後一頁的總計與備註 */
            .totals {
              border-top: 2px solid #000;
              border-bottom: 3px double #000;
              padding: 2mm 1.5mm;
              text-align: right;
              font-size: 11pt;
              font-weight: bold;
              margin-top: 0;
            }
            .total-num { font-size: 13pt; }
            .notes {
              margin-top: 2mm;
              font-size: 8.5pt;
              line-height: 1.55;
            }
            .notes-title { font-weight: bold; }

            /* FOOTER（章區固定在頁面底部） */
            .sheet-footer {
              flex: 0 0 auto;
              margin-top: 2mm;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .sign-area {
              display: flex;
              gap: 3mm;
              align-items: stretch;
              justify-content: flex-end;
            }
            .sign-box {
              flex: 1 1 0;
              height: 22mm;
              border: 1px solid #000;
              padding: 1mm 1.5mm;
              display: flex;
              flex-direction: column;
            }
            .sign-label { font-size: 8.5pt; }
            .sign-blank { flex: 1; }
            .stamp-box {
              flex: 0 0 50mm;
              height: 22mm;
              border: 1px dashed #000;
              position: relative;
            }
            .stamp-label {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%);
              font-size: 9pt;
              color: #888;
              letter-spacing: 2px;
              white-space: nowrap;
            }
            .page-num {
              text-align: right;
              font-size: 8.5pt;
              padding-top: 1.5mm;
            }

            /* 螢幕預覽：每頁紙之間留間距、加陰影 */
            @media screen {
              body { padding: 10mm; }
              .sheet { margin: 0 auto 10mm; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
            }
            @media print {
              body { background: #fff; padding: 0; }
              .sheet { margin: 0; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
        </html>
      `;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(receiptContent);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
      }
      return;
    }

    // ============ 一般結帳單版（原有版面）============
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>結帳單 ${settlement.settlement_number}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm 10mm 20mm 10mm;
            @bottom-right { content: counter(page) " / " counter(pages); font-family: Arial, sans-serif; font-size: 11px; color: #555; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h1 { font-size: 24px; margin-bottom: 20px; }
          .info { margin-bottom: 20px; }
          .info-row { display: flex; margin-bottom: 8px; align-items: baseline; }
          .info-label { width: 110px; color: #666; }
          .info-value { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          thead { display: table-header-group; }
          tr, td, th { page-break-inside: avoid; }
          th { background: #333; color: white; padding: 8px; text-align: left; }
          td { border-bottom: 1px solid #ddd; }
          .total { margin-top: 20px; text-align: right; font-size: 24px; font-weight: bold; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>結帳單 ${settlement.settlement_number}</h1>
        <div class="info">
          <div class="info-row"><span class="info-label">客戶</span><span class="info-value">${settlement.customer?.name || ''}</span></div>
          <div class="info-row"><span class="info-label">結帳區間</span><span class="info-value">${settlement.period_start} ~ ${settlement.period_end}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>品項</th>
              <th style="text-align: right;">數量</th>
              <th style="text-align: right;">單價</th>
              <th style="text-align: right;">小計</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total">總金額: $${total}</div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">結帳管理</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增結帳單
        </Button>
      </div>

      {/* Customer Filter */}
      <div className="flex items-center gap-2">
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="客戶篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部客戶</SelectItem>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredSettlements.length} 筆</span>
      </div>

      {/* Settlements List */}
      <div className="space-y-2">
        {filteredSettlements.map(settlement => (
          <Card key={settlement.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold">{settlement.settlement_number}</span>
                  <span className="ml-2 text-muted-foreground">{settlement.customer?.name}</span>
                  <div className="text-sm text-muted-foreground">
                    {settlement.period_start} ~ {settlement.period_end}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-bold">${calculateRoundedTotal(settlement).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      已收 ${Number(settlement.paid_amount).toLocaleString()}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    settlement.status === 'partial_paid' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    settlement.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  }`}>
                    {settlement.status === 'partial_paid' ? '部分收款' :
                     settlement.status === 'paid' ? '已收款' : '待付款'}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => handlePrint(settlement, 'standard')} title="列印/PDF">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handlePrint(settlement, 'receipt-stamp')} title="公司章版">
                    <span className="text-xs font-medium">章</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExportExcel(settlement)} title="Excel">
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowDetailDialog(settlement.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {settlement.status !== 'paid' && (
                    <Button size="sm" variant="outline" onClick={() => setShowPaymentDialog(settlement.id)}>
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDeleteSettlement(settlement.id, settlement.settlement_number)}
                    title="刪除結帳單"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增結帳單</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newCustomerId} onValueChange={setNewCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇客戶" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-muted-foreground">起始日期</label>
                <Input type="date" value={newPeriodStart} onChange={e => setNewPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">結束日期</label>
                <Input type="date" value={newPeriodEnd} onChange={e => setNewPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreate}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetailDialog} onOpenChange={() => setShowDetailDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>結帳單明細 {selectedSettlement?.settlement_number}</DialogTitle>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">客戶</div>
                <div className="font-medium">{selectedSettlement.customer?.name}</div>
                <div className="text-muted-foreground">結帳區間</div>
                <div>{selectedSettlement.period_start} ~ {selectedSettlement.period_end}</div>
                <div className="text-muted-foreground">總金額</div>
                <div className="font-bold">${calculateRoundedTotal(selectedSettlement).toLocaleString()}</div>
                <div className="text-muted-foreground">已收款</div>
                <div className="text-green-600">${Math.round(Number(selectedSettlement.paid_amount)).toLocaleString()}</div>
                <div className="text-muted-foreground">未收款</div>
                <div className="text-destructive font-bold">
                  ${(calculateRoundedTotal(selectedSettlement) - Math.round(Number(selectedSettlement.paid_amount))).toLocaleString()}
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">結帳品項</h4>
                <div className="space-y-3">
                  {(() => {
                    // Group items by order_date
                    const grouped = (selectedSettlement.settlement_items || []).reduce((acc, item) => {
                      const date = (item as any).order_date || '未知日期';
                      if (!acc[date]) acc[date] = [];
                      acc[date].push(item);
                      return acc;
                    }, {} as Record<string, typeof selectedSettlement.settlement_items>);
                    
                    return Object.entries(grouped)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([date, items]) => (
                        <div key={date} className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground border-b pb-1">
                            {date !== '未知日期' ? format(parseISO(date), 'M/d (EEEE)', { locale: zhTW }) : date}
                          </div>
                          {items?.map(item => (
                            <div key={item.id} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded p-2">
                              <span className="flex-1">{item.item_name}</span>
                              <span className="text-muted-foreground">{item.settlement_quantity} {item.settlement_unit} × ${item.settlement_unit_price}</span>
                              <span className="font-medium text-primary">${Number(item.subtotal).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ));
                  })()}
                </div>
              </div>

              {selectedSettlement.payments && selectedSettlement.payments.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">收款紀錄</h4>
                  <div className="space-y-1">
                    {selectedSettlement.payments.map(payment => (
                      <div key={payment.id} className="flex justify-between text-sm">
                        <span>{payment.payment_date}</span>
                        <span className="text-green-600">${Number(payment.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Export buttons */}
              <div className="flex gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => handlePrint(selectedSettlement, 'standard')} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  列印 / PDF
                </Button>
                <Button variant="outline" onClick={() => handlePrint(selectedSettlement, 'receipt-stamp')} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  公司章版
                </Button>
                <Button variant="outline" onClick={() => handleExportExcel(selectedSettlement)} className="flex-1">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!showPaymentDialog} onOpenChange={() => setShowPaymentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增收款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">收款金額</label>
              <div className="flex gap-2">
                <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="金額" />
                {(() => {
                  const s = settlements.find(x => x.id === showPaymentDialog);
                  if (!s) return null;
                  const outstanding = calculateRoundedTotal(s) - Math.round(Number(s.paid_amount));
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPaymentAmount(String(outstanding))}
                      className="whitespace-nowrap"
                    >
                      全額 ${outstanding.toLocaleString()}
                    </Button>
                  );
                })()}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">收款日期</label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
              <SelectTrigger>
                <SelectValue placeholder="付款方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">現金</SelectItem>
                <SelectItem value="transfer">轉帳</SelectItem>
                <SelectItem value="check">支票</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(null)}>取消</Button>
            <Button onClick={handleAddPayment}>確認收款</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
