import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, Package, DollarSign, X, List, Percent, ChevronDown, ChevronRight } from 'lucide-react';
import { useAccounting, AccountingEntryType, AccountingEntry } from '@/hooks/useAccounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/combobox';
import { WheelNumberInput } from '@/components/ui/wheel-number-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ImportAuctionDialog from './ImportAuctionDialog';

const DEFAULT_CATEGORIES: Record<AccountingEntryType, string[]> = {
  income: ['收款', '其他收入'],
  expense: ['運費', '油費', '雜支', '水電', '人事', '其他支出'],
  purchase: ['進貨'],
};

const CUSTOM_CATEGORIES_KEY = 'accounting_custom_categories';

const loadCustomCategories = (): Record<AccountingEntryType, string[]> => {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { income: [], expense: [], purchase: [] };
};

const saveCustomCategories = (categories: Record<AccountingEntryType, string[]>) => {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
};

const ENTRY_TYPE_LABELS: Record<AccountingEntryType, string> = {
  income: '收入',
  expense: '支出',
  purchase: '進貨',
};

const ENTRY_TYPE_COLORS: Record<AccountingEntryType, string> = {
  income: 'bg-green-500',
  expense: 'bg-red-500',
  purchase: 'bg-blue-500',
};

type DateRange = 'today' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';

export default function AdminAccounting() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [customCategories, setCustomCategories] = useState<Record<AccountingEntryType, string[]>>(loadCustomCategories);

  // Collapsible states
  const [isEntriesOpen, setIsEntriesOpen] = useState(true);
  const [isCategoryStatsOpen, setIsCategoryStatsOpen] = useState(false);
  const [isPurchaseStatsOpen, setIsPurchaseStatsOpen] = useState(false);
  const [isIncomeStatsOpen, setIsIncomeStatsOpen] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formType, setFormType] = useState<AccountingEntryType>('expense');
  const [formCategory, setFormCategory] = useState('');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formItemName, setFormItemName] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState('公斤');
  const [formUnitCustom, setFormUnitCustom] = useState('');
  const [formUnitPrice, setFormUnitPrice] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');

  // Bulk form state
  interface BulkEntryItem {
    id: string;
    itemName: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    amount: string;
    note: string;
  }
  const [bulkDate, setBulkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bulkType, setBulkType] = useState<AccountingEntryType>('purchase');
  const [bulkCategory, setBulkCategory] = useState('進貨');
  const [bulkItems, setBulkItems] = useState<BulkEntryItem[]>([
    { id: crypto.randomUUID(), itemName: '', quantity: '', unit: '公斤', unitPrice: '', amount: '', note: '' }
  ]);

  // Get all categories for current type (default + custom)
  const getAllCategories = (type: AccountingEntryType) => {
    const defaults = DEFAULT_CATEGORIES[type] || [];
    const customs = customCategories[type] || [];
    return [...defaults, ...customs.filter(c => !defaults.includes(c))];
  };

  const addCustomCategory = (type: AccountingEntryType, category: string) => {
    if (!category.trim()) return;
    const trimmed = category.trim();
    const allCats = getAllCategories(type);
    if (allCats.includes(trimmed)) return; // Already exists

    const updated = {
      ...customCategories,
      [type]: [...(customCategories[type] || []), trimmed],
    };
    setCustomCategories(updated);
    saveCustomCategories(updated);
    setFormCategory(trimmed);
    setFormCustomCategory('');
    toast.success(`已新增分類「${trimmed}」`);
  };

  const removeCustomCategory = (type: AccountingEntryType, category: string) => {
    const updated = {
      ...customCategories,
      [type]: (customCategories[type] || []).filter(c => c !== category),
    };
    setCustomCategories(updated);
    saveCustomCategories(updated);
    toast.success(`已刪除分類「${category}」`);
  };

  const getDateFilters = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'week':
        return { 
          startDate: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), 
          endDate: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') 
        };
      case 'month':
        return { 
          startDate: format(startOfMonth(today), 'yyyy-MM-dd'), 
          endDate: format(endOfMonth(today), 'yyyy-MM-dd') 
        };
      case 'lastMonth': {
        const lastMonth = subMonths(today, 1);
        return { 
          startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), 
          endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd') 
        };
      }
      case 'year':
        return { 
          startDate: format(startOfYear(today), 'yyyy-MM-dd'), 
          endDate: format(today, 'yyyy-MM-dd') 
        };
      case 'custom':
        return { startDate: customStart, endDate: customEnd };
      default:
        return {};
    }
  };

  const { startDate, endDate } = getDateFilters();
  const { entries, isLoading, createEntry, createBulkEntries, updateEntry, deleteEntry, getStats } = useAccounting({ startDate, endDate });
  const stats = getStats();

  // Extract unique item names from entries for autocomplete
  const itemNameOptions = useMemo(() => {
    const names = entries
      .filter(e => e.item_name)
      .map(e => e.item_name as string);
    return [...new Set(names)].sort();
  }, [entries]);

  // Purchase item statistics with separate units
  const purchaseItemStats = useMemo(() => {
    const purchaseEntries = entries.filter(e => e.entry_type === 'purchase' && e.item_name);
    if (purchaseEntries.length === 0) return [];

    // Group by item_name + unit (separate different units)
    const itemStats: Record<string, { itemName: string; totalAmount: number; totalQuantity: number; unit: string }> = {};
    purchaseEntries.forEach(e => {
      const unit = e.unit || '未知';
      const key = `${e.item_name}_${unit}`;
      if (!itemStats[key]) {
        itemStats[key] = { itemName: e.item_name!, totalAmount: 0, totalQuantity: 0, unit };
      }
      itemStats[key].totalAmount += e.amount;
      if (e.quantity) {
        itemStats[key].totalQuantity += e.quantity;
      }
    });

    const rows = Object.values(itemStats).map(data => ({
      ...data,
      avgUnitPrice: data.totalQuantity > 0 ? data.totalAmount / data.totalQuantity : 0,
    }));

    // Compute per-item totals (merge different units) for sorting item groups by total amount.
    const itemTotalAmount: Record<string, number> = {};
    rows.forEach(r => {
      itemTotalAmount[r.itemName] = (itemTotalAmount[r.itemName] || 0) + r.totalAmount;
    });

    // Sort rules:
    // 1) Item groups by total amount (desc)
    // 2) Keep same item together
    // 3) Within same item, sort units by total amount (desc)
    // 4) Stable tiebreaker by unit name
    return rows.sort((a, b) => {
      const groupA = itemTotalAmount[a.itemName] || 0;
      const groupB = itemTotalAmount[b.itemName] || 0;
      if (groupA !== groupB) return groupB - groupA;

      const nameCompare = a.itemName.localeCompare(b.itemName, 'zh-TW');
      if (nameCompare !== 0) return nameCompare;

      if (a.totalAmount !== b.totalAmount) return b.totalAmount - a.totalAmount;
      return a.unit.localeCompare(b.unit, 'zh-TW');
    });
  }, [entries]);

  // Income item statistics with separate units
  const incomeItemStats = useMemo(() => {
    const incomeEntries = entries.filter(e => e.entry_type === 'income' && e.item_name);
    if (incomeEntries.length === 0) return [];

    const itemStats: Record<string, { itemName: string; totalAmount: number; totalQuantity: number; unit: string }> = {};
    incomeEntries.forEach(e => {
      const unit = e.unit || '未知';
      const key = `${e.item_name}_${unit}`;
      if (!itemStats[key]) {
        itemStats[key] = { itemName: e.item_name!, totalAmount: 0, totalQuantity: 0, unit };
      }
      itemStats[key].totalAmount += e.amount;
      if (e.quantity) {
        itemStats[key].totalQuantity += e.quantity;
      }
    });

    return Object.values(itemStats)
      .map(data => ({
        ...data,
        avgUnitPrice: data.totalQuantity > 0 ? data.totalAmount / data.totalQuantity : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [entries]);

  const resetForm = () => {
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormType('expense');
    setFormCategory('');
    setFormCustomCategory('');
    setFormItemName('');
    setFormQuantity('');
    setFormUnit('公斤');
    setFormUnitCustom('');
    setFormUnitPrice('');
    setFormAmount('');
    setFormNote('');
    setEditingEntry(null);
  };

  const resetBulkForm = () => {
    setBulkDate(format(new Date(), 'yyyy-MM-dd'));
    setBulkType('purchase');
    setBulkCategory('進貨');
    setBulkItems([{ id: crypto.randomUUID(), itemName: '', quantity: '', unit: '公斤', unitPrice: '', amount: '', note: '' }]);
  };

  const addBulkItem = () => {
    setBulkItems([...bulkItems, { id: crypto.randomUUID(), itemName: '', quantity: '', unit: '公斤', unitPrice: '', amount: '', note: '' }]);
  };

  const removeBulkItem = (id: string) => {
    if (bulkItems.length <= 1) return;
    setBulkItems(bulkItems.filter(item => item.id !== id));
  };

  const updateBulkItem = (id: string, field: keyof BulkEntryItem, value: string) => {
    setBulkItems(bulkItems.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Auto-calculate amount
      if (field === 'quantity' || field === 'unitPrice') {
        const q = parseFloat(field === 'quantity' ? value : item.quantity);
        const p = parseFloat(field === 'unitPrice' ? value : item.unitPrice);
        if (!isNaN(q) && !isNaN(p)) {
          updated.amount = (q * p).toString();
        }
      }
      return updated;
    }));
  };

  const handleBulkSubmit = async () => {
    const validItems = bulkItems.filter(item => item.itemName && item.amount);
    if (validItems.length === 0) {
      toast.error('請至少填寫一筆有效資料（品名和金額）');
      return;
    }

    const entriesData = validItems.map(item => ({
      entry_date: bulkDate,
      entry_type: bulkType,
      category: bulkCategory,
      item_name: item.itemName,
      quantity: item.quantity ? parseFloat(item.quantity) : undefined,
      unit: item.unit || undefined,
      unit_price: item.unitPrice ? parseFloat(item.unitPrice) : undefined,
      amount: parseFloat(item.amount),
      note: item.note || undefined,
    }));

    const { error } = await createBulkEntries(entriesData);
    if (error) {
      toast.error((error as any)?.message || '批量新增失敗');
    } else {
      toast.success(`成功新增 ${validItems.length} 筆記帳`);
      setIsBulkAddOpen(false);
      resetBulkForm();
    }
  };

  const openEditDialog = (entry: AccountingEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.entry_date);
    setFormType(entry.entry_type);
    setFormCategory(entry.category);
    setFormItemName(entry.item_name || '');
    setFormQuantity(entry.quantity?.toString() || '');
    setFormUnit(entry.unit || '');
    setFormUnitPrice(entry.unit_price?.toString() || '');
    setFormAmount(entry.amount.toString());
    setFormNote(entry.note || '');
    setIsAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!formCategory || !formAmount) {
      toast.error('請填寫分類和金額');
      return;
    }

    const entryData = {
      entry_date: formDate,
      entry_type: formType,
      category: formCategory,
      item_name: formItemName || undefined,
      quantity: formQuantity ? parseFloat(formQuantity) : undefined,
      unit: formUnit === 'custom' ? formUnitCustom : formUnit || undefined,
      unit_price: formUnitPrice ? parseFloat(formUnitPrice) : undefined,
      amount: parseFloat(formAmount),
      note: formNote || undefined,
    };

    if (editingEntry) {
      const { error } = await updateEntry(editingEntry.id, entryData);
      if (error) {
        toast.error((error as any)?.message || '更新失敗');
      } else {
        toast.success('更新成功');
        setIsAddOpen(false);
        resetForm();
      }
    } else {
      const { error } = await createEntry(entryData);
      if (error) {
        toast.error((error as any)?.message || '新增失敗');
      } else {
        toast.success('新增成功');
        setIsAddOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此筆記錄？')) return;
    const { error } = await deleteEntry(id);
    if (error) {
      toast.error((error as any)?.message || '刪除失敗');
    } else {
      toast.success('已刪除');
    }
  };

  // Auto-calculate amount when quantity and unit_price change
  const handleQuantityOrPriceChange = (qty: string, price: string) => {
    const q = parseFloat(qty);
    const p = parseFloat(price);
    if (!isNaN(q) && !isNaN(p)) {
      setFormAmount((q * p).toString());
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="today">今日</TabsTrigger>
            <TabsTrigger value="week">本週</TabsTrigger>
            <TabsTrigger value="month">本月</TabsTrigger>
            <TabsTrigger value="lastMonth">上個月</TabsTrigger>
            <TabsTrigger value="year">今年</TabsTrigger>
            <TabsTrigger value="custom">自訂</TabsTrigger>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              收入
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">${stats.totalIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-4 w-4 text-blue-500" />
              進貨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-blue-600">${stats.totalPurchase.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              支出
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">${stats.totalExpense.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              損益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${stats.profit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Percent className="h-4 w-4 text-purple-500" />
              毛利率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${stats.totalIncome > 0 ? ((stats.totalIncome - stats.totalPurchase - stats.totalExpense) / stats.totalIncome * 100) >= 0 ? 'text-purple-600' : 'text-red-600' : 'text-muted-foreground'}`}>
              {stats.totalIncome > 0 
                ? `${((stats.totalIncome - stats.totalPurchase - stats.totalExpense) / stats.totalIncome * 100).toFixed(1)}%`
                : '-'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Entry Buttons */}
      <div className="flex gap-2">
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              新增記帳
            </Button>
          </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? '編輯記帳' : '新增記帳'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>日期</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div>
                <Label>類型</Label>
                <Select value={formType} onValueChange={(v) => { setFormType(v as AccountingEntryType); setFormCategory(''); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="expense">支出</SelectItem>
                    <SelectItem value="purchase">進貨</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>分類</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {getAllCategories(formType).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center justify-between w-full gap-2">
                        {cat}
                        {customCategories[formType]?.includes(cat) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomCategory(formType, cat);
                              if (formCategory === cat) setFormCategory('');
                            }}
                            className="ml-2 text-destructive hover:text-destructive/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 mt-2">
                <Input
                  value={formCustomCategory}
                  onChange={(e) => setFormCustomCategory(e.target.value)}
                  placeholder="輸入新分類..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomCategory(formType, formCustomCategory);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomCategory(formType, formCustomCategory)}
                  disabled={!formCustomCategory.trim()}
                >
                  新增
                </Button>
              </div>
            </div>
            {(formType === 'purchase' || formType === 'income') && (
              <div>
                <Label>品項名稱</Label>
                <Combobox
                  value={formItemName}
                  onValueChange={setFormItemName}
                  options={itemNameOptions}
                  placeholder="選擇或輸入品項"
                  emptyText="尚無品項記錄"
                />
              </div>
            )}
            {formType === 'purchase' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>數量</Label>
                  <WheelNumberInput
                    value={formQuantity}
                    onChange={(e) => {
                      setFormQuantity(e.target.value);
                      handleQuantityOrPriceChange(e.target.value, formUnitPrice);
                    }}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label>單位</Label>
                  <Select value={formUnit} onValueChange={(v) => { setFormUnit(v); if (v !== 'custom') setFormUnitCustom(''); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="公斤">公斤</SelectItem>
                      <SelectItem value="件">件</SelectItem>
                      <SelectItem value="custom">自行輸入</SelectItem>
                    </SelectContent>
                  </Select>
                  {formUnit === 'custom' && (
                    <Input
                      value={formUnitCustom}
                      onChange={(e) => setFormUnitCustom(e.target.value)}
                      placeholder="輸入單位"
                      className="mt-2"
                    />
                  )}
                </div>
                <div>
                  <Label>單價</Label>
                  <WheelNumberInput
                    value={formUnitPrice}
                    onChange={(e) => {
                      setFormUnitPrice(e.target.value);
                      handleQuantityOrPriceChange(formQuantity, e.target.value);
                    }}
                    placeholder="20"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>金額</Label>
              <Input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="輸入金額"
              />
            </div>
            <div>
              <Label>備註</Label>
              <Input
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="選填"
              />
            </div>
            <Button onClick={handleSubmit} className="w-full">
              {editingEntry ? '更新' : '儲存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

        <Dialog open={isBulkAddOpen} onOpenChange={(open) => { setIsBulkAddOpen(open); if (!open) resetBulkForm(); }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <List className="h-4 w-4 mr-1" />
              批量記帳
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>批量新增記帳</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>日期</Label>
                  <Input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>類型</Label>
                  <Select value={bulkType} onValueChange={(v) => { setBulkType(v as AccountingEntryType); setBulkCategory(getAllCategories(v as AccountingEntryType)[0] || ''); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="income">收入</SelectItem>
                      <SelectItem value="expense">支出</SelectItem>
                      <SelectItem value="purchase">進貨</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>分類</Label>
                  <Select value={bulkCategory} onValueChange={setBulkCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {getAllCategories(bulkType).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>品項列表</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addBulkItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    新增一列
                  </Button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">品名</TableHead>
                        <TableHead className="w-16">數量</TableHead>
                        <TableHead className="w-16">單位</TableHead>
                        <TableHead className="w-16">單價</TableHead>
                        <TableHead className="w-20">金額</TableHead>
                        <TableHead className="w-24">備註</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="p-1">
                            <Combobox
                              value={item.itemName}
                              onValueChange={(v) => updateBulkItem(item.id, 'itemName', v)}
                              options={itemNameOptions}
                              placeholder="品名"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <WheelNumberInput
                              value={item.quantity}
                              onChange={(e) => updateBulkItem(item.id, 'quantity', e.target.value)}
                              placeholder="數量"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Select value={item.unit} onValueChange={(v) => updateBulkItem(item.id, 'unit', v)}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                <SelectItem value="公斤">公斤</SelectItem>
                                <SelectItem value="件">件</SelectItem>
                                <SelectItem value="箱">箱</SelectItem>
                                <SelectItem value="包">包</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <WheelNumberInput
                              value={item.unitPrice}
                              onChange={(e) => updateBulkItem(item.id, 'unitPrice', e.target.value)}
                              placeholder="單價"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <WheelNumberInput
                              value={item.amount}
                              onChange={(e) => updateBulkItem(item.id, 'amount', e.target.value)}
                              placeholder="金額"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.note}
                              onChange={(e) => updateBulkItem(item.id, 'note', e.target.value)}
                              placeholder="備註"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeBulkItem(item.id)}
                              disabled={bulkItems.length <= 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  共 {bulkItems.filter(i => i.itemName && i.amount).length} 筆有效資料
                </span>
                <Button onClick={handleBulkSubmit}>
                  批量儲存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ImportAuctionDialog />
      </div>


      {/* Entries Table - Collapsible */}
      <Collapsible open={isEntriesOpen} onOpenChange={setIsEntriesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span>帳目明細</span>
                {isEntriesOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">載入中...</div>
              ) : entries.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">尚無記錄</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">日期</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>分類</TableHead>
                      <TableHead>明細</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {format(new Date(entry.entry_date), 'MM/dd')}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${ENTRY_TYPE_COLORS[entry.entry_type]} text-white`}>
                            {ENTRY_TYPE_LABELS[entry.entry_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.item_name && (
                            <span>
                              {entry.item_name}
                              {entry.quantity && entry.unit && ` ${entry.quantity}${entry.unit}`}
                              {entry.unit_price && ` $${entry.unit_price}`}
                            </span>
                          )}
                          {entry.note && <span className="ml-1">({entry.note})</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${entry.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(entry)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Category Summary - Collapsible */}
      {Object.keys(stats.byCategory).length > 0 && (
        <Collapsible open={isCategoryStatsOpen} onOpenChange={setIsCategoryStatsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>分類統計</span>
                  {isCategoryStatsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(stats.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm">{category}</span>
                        <span className="font-medium">${amount.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Purchase Item Statistics - Collapsible */}
      {purchaseItemStats.length > 0 && (
        <Collapsible open={isPurchaseStatsOpen} onOpenChange={setIsPurchaseStatsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    進貨明細統計
                  </span>
                  {isPurchaseStatsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>品項</TableHead>
                      <TableHead className="text-right">數量</TableHead>
                      <TableHead className="text-right">總金額</TableHead>
                      <TableHead className="text-right">平均單價</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItemStats.map((data, idx) => (
                      <TableRow key={`${data.itemName}_${data.unit}_${idx}`}>
                        <TableCell className="font-medium">{data.itemName}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.totalQuantity > 0 ? `${data.totalQuantity}${data.unit}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          ${Math.round(data.totalAmount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.avgUnitPrice > 0 ? `$${Math.round(data.avgUnitPrice)}/${data.unit}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Income Item Statistics - Collapsible */}
      {incomeItemStats.length > 0 && (
        <Collapsible open={isIncomeStatsOpen} onOpenChange={setIsIncomeStatsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    收入明細統計
                  </span>
                  {isIncomeStatsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>品項</TableHead>
                      <TableHead className="text-right">數量</TableHead>
                      <TableHead className="text-right">總金額</TableHead>
                      <TableHead className="text-right">平均單價</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeItemStats.map((data, idx) => (
                      <TableRow key={`${data.itemName}_${data.unit}_${idx}`}>
                        <TableCell className="font-medium">{data.itemName}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.totalQuantity > 0 ? `${data.totalQuantity}${data.unit}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          ${Math.round(data.totalAmount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.avgUnitPrice > 0 ? `$${Math.round(data.avgUnitPrice)}/${data.unit}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
