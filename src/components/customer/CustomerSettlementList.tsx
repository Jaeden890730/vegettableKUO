import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { FileText, ChevronDown, ChevronUp, Calendar, DollarSign, CheckCircle, AlertCircle, Printer, FileSpreadsheet } from 'lucide-react';
import { useSettlements } from '@/hooks/useSettlements';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Settlement, SettlementItem, Payment } from '@/types/order';
import * as XLSX from 'xlsx';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

interface CustomerSettlementListProps {
  customerId: string | null;
}

export default function CustomerSettlementList({ customerId }: CustomerSettlementListProps) {
  const { settlements, isLoading } = useSettlements({ customerId });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  // Filter settlements by date range
  const filteredSettlements = useMemo(() => {
    return settlements.filter(settlement => {
      if (start && settlement.period_end < start) return false;
      if (end && settlement.period_start > end) return false;
      return true;
    });
  }, [settlements, start, end]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'partial_paid':
        return <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600"><DollarSign className="h-3 w-3" />部分付款</Badge>;
      case 'paid':
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />已付清</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><AlertCircle className="h-3 w-3" />待付款</Badge>;
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return '現金';
      case 'transfer': return '轉帳';
      case 'check': return '支票';
      default: return '其他';
    }
  };

  const calculateRoundedTotal = (items: SettlementItem[] | undefined) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + Math.round(item.subtotal), 0);
  };

  // Calculate summary stats
  const unpaidAmount = filteredSettlements
    .filter(s => s.status !== 'paid')
    .reduce((sum, s) => {
      const roundedTotal = calculateRoundedTotal(s.settlement_items);
      return sum + (roundedTotal - s.paid_amount);
    }, 0);

  const paidAmount = filteredSettlements
    .reduce((sum, s) => sum + s.paid_amount, 0);

  // Print/PDF function
  const handlePrint = (settlement: Settlement) => {
    const items = settlement.settlement_items || [];
    const payments = settlement.payments || [];
    const roundedTotal = calculateRoundedTotal(items);
    const remainingAmount = roundedTotal - settlement.paid_amount;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>結帳單 ${settlement.settlement_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          .info { margin-bottom: 20px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .payment-section { margin-top: 20px; }
          .summary { margin-top: 20px; font-size: 18px; }
        </style>
      </head>
      <body>
        <h1>結帳單 ${settlement.settlement_number}</h1>
        <div class="info">
          期間: ${format(new Date(settlement.period_start), 'yyyy/MM/dd')} - ${format(new Date(settlement.period_end), 'yyyy/MM/dd')}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>品項</th>
              <th class="text-right">數量</th>
              <th class="text-right">單價</th>
              <th class="text-right">小計</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.item_name}${item.order_date ? ` (${format(new Date(item.order_date), 'MM/dd')})` : ''}</td>
                <td class="text-right">${item.settlement_quantity} ${item.settlement_unit}</td>
                <td class="text-right">$${item.settlement_unit_price}</td>
                <td class="text-right">$${Math.round(item.subtotal).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3" class="text-right">總計</td>
              <td class="text-right">$${roundedTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        ${payments.length > 0 ? `
          <div class="payment-section">
            <h3>付款紀錄</h3>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>方式</th>
                  <th class="text-right">金額</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td>${format(new Date(p.payment_date), 'yyyy/MM/dd')}</td>
                    <td>${getPaymentMethodText(p.payment_method)}</td>
                    <td class="text-right">$${p.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        <div class="summary">
          <p>總金額: $${roundedTotal.toLocaleString()}</p>
          <p>已付金額: $${settlement.paid_amount.toLocaleString()}</p>
          ${remainingAmount > 0 ? `<p style="color: #d97706;">待付金額: $${remainingAmount.toLocaleString()}</p>` : ''}
        </div>
        
        ${settlement.note ? `<p style="margin-top: 20px; color: #666;">備註: ${settlement.note}</p>` : ''}
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

  // Excel export function
  const handleExportExcel = (settlement: Settlement) => {
    const items = settlement.settlement_items || [];
    const payments = settlement.payments || [];
    const roundedTotal = calculateRoundedTotal(items);

    // Create items sheet data
    const itemsData = items.map(item => ({
      '品項': item.item_name,
      '訂單日期': item.order_date ? format(new Date(item.order_date), 'yyyy/MM/dd') : '',
      '數量': item.settlement_quantity,
      '單位': item.settlement_unit,
      '單價': item.settlement_unit_price,
      '小計': Math.round(item.subtotal),
    }));
    
    // Add total row
    itemsData.push({
      '品項': '總計',
      '訂單日期': '',
      '數量': 0,
      '單位': '',
      '單價': 0,
      '小計': roundedTotal,
    });

    // Create payments sheet data
    const paymentsData = payments.map(p => ({
      '日期': format(new Date(p.payment_date), 'yyyy/MM/dd'),
      '方式': getPaymentMethodText(p.payment_method),
      '金額': p.amount,
      '備註': p.note || '',
    }));

    const wb = XLSX.utils.book_new();
    
    // Add items sheet
    const wsItems = XLSX.utils.json_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(wb, wsItems, '結帳明細');
    
    // Add payments sheet if there are payments
    if (paymentsData.length > 0) {
      const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(wb, wsPayments, '付款紀錄');
    }

    // Download
    XLSX.writeFile(wb, `結帳單_${settlement.settlement_number}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">結帳單</h2>

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
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="text-sm text-amber-700">待付金額</div>
            <div className="text-xl font-bold text-amber-900">${unpaidAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-sm text-green-700">已付金額</div>
            <div className="text-xl font-bold text-green-900">${paidAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Settlements List */}
      {filteredSettlements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>此區間無結帳單</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSettlements.map((settlement) => {
            const isExpanded = expandedIds.has(settlement.id);
            const items = settlement.settlement_items || [];
            const payments = settlement.payments || [];
            const roundedTotal = calculateRoundedTotal(items);
            const remainingAmount = roundedTotal - settlement.paid_amount;

            return (
              <Card key={settlement.id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(settlement.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-muted-foreground">
                              {settlement.settlement_number}
                            </span>
                            {getStatusBadge(settlement.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {format(new Date(settlement.period_start), 'MM/dd', { locale: zhTW })}
                              {' - '}
                              {format(new Date(settlement.period_end), 'MM/dd', { locale: zhTW })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-lg">${roundedTotal.toLocaleString()}</div>
                            {remainingAmount > 0 && settlement.status !== 'paid' && (
                              <div className="text-xs text-amber-600">
                                待付: ${remainingAmount.toLocaleString()}
                              </div>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 px-4 pb-4">
                      {/* Export Buttons */}
                      <div className="flex gap-2 mb-4">
                        <Button size="sm" variant="outline" onClick={() => handlePrint(settlement)}>
                          <Printer className="h-4 w-4 mr-1" />
                          列印/PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleExportExcel(settlement)}>
                          <FileSpreadsheet className="h-4 w-4 mr-1" />
                          Excel
                        </Button>
                      </div>

                      {/* Items Table */}
                      <div className="border rounded-lg overflow-hidden mb-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="py-2">品項</TableHead>
                              <TableHead className="py-2 text-right">數量</TableHead>
                              <TableHead className="py-2 text-right">單價</TableHead>
                              <TableHead className="py-2 text-right">小計</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="py-2">
                                  <div>
                                    {item.item_name}
                                    {item.order_date && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({format(new Date(item.order_date), 'MM/dd')})
                                      </span>
                                    )}
                                  </div>
                                  {item.note && (
                                    <div className="text-xs text-muted-foreground">{item.note}</div>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  {item.settlement_quantity} {item.settlement_unit}
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  ${item.settlement_unit_price}
                                </TableCell>
                                <TableCell className="py-2 text-right font-medium">
                                  ${Math.round(item.subtotal).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30 font-bold">
                              <TableCell colSpan={3} className="py-2 text-right">
                                總計
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                ${roundedTotal.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {/* Payments */}
                      {payments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            付款紀錄
                          </h4>
                          <div className="space-y-2">
                            {payments.map((payment) => (
                              <div 
                                key={payment.id}
                                className="flex items-center justify-between p-2 bg-green-50 rounded-lg text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    {format(new Date(payment.payment_date), 'yyyy/MM/dd')}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {getPaymentMethodText(payment.payment_method)}
                                  </Badge>
                                </div>
                                <span className="font-medium text-green-700">
                                  +${payment.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Note */}
                      {settlement.note && (
                        <div className="mt-3 p-2 bg-muted/30 rounded text-sm text-muted-foreground">
                          備註: {settlement.note}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
