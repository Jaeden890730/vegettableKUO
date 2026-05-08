import { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { Vegetable, VegetableStatus, VegetablePrice } from '@/types/vegetable';
import { Combobox } from '@/components/ui/combobox';

interface PriceEntry {
  id?: string;
  unit: string;
  price: string;
  isNew?: boolean;
  toDelete?: boolean;
}

interface AddVegetableFormProps {
  onAdd: (vegetable: Omit<Vegetable, 'id' | 'sort_order' | 'updated_at' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
  editingVegetable?: Vegetable | null;
  onUpdate?: (id: string, updates: Partial<Vegetable>) => Promise<void>;
  onAddPrice?: (vegetableId: string, unit: string, price: number) => Promise<void>;
  onUpdatePrice?: (priceId: string, vegetableId: string, unit: string, price: number) => Promise<void>;
  onDeletePrice?: (priceId: string, vegetableId: string) => Promise<void>;
  existingTags?: string[];
  existingSuppliers?: string[];
}

const PRESET_UNITS = ['斤', '件', '箱', '公斤', '把'];

export function AddVegetableForm({ 
  onAdd, 
  onCancel, 
  editingVegetable, 
  onUpdate,
  onAddPrice,
  onUpdatePrice,
  onDeletePrice,
  existingTags = [],
  existingSuppliers = [],
}: AddVegetableFormProps) {
  const [name, setName] = useState(editingVegetable?.name || '');
  const [status, setStatus] = useState<VegetableStatus>(editingVegetable?.status || 'in_stock');
  const [note, setNote] = useState(editingVegetable?.note || '');
  const [tag, setTag] = useState(editingVegetable?.tag || '');
  const [supplier, setSupplier] = useState(editingVegetable?.supplier || '');
  const [isWholesale, setIsWholesale] = useState(editingVegetable?.is_wholesale || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize prices from editing vegetable or single default price
  const getInitialPrices = (): PriceEntry[] => {
    if (editingVegetable?.prices && editingVegetable.prices.length > 0) {
      return editingVegetable.prices.map(p => ({
        id: p.id,
        unit: p.unit,
        price: p.price.toString(),
      }));
    }
    return [{ unit: '斤', price: '', isNew: true }];
  };

  const [prices, setPrices] = useState<PriceEntry[]>(getInitialPrices);

  const isEditing = !!editingVegetable;

  const handleAddPriceRow = () => {
    setPrices([...prices, { unit: '斤', price: '', isNew: true }]);
  };

  const handleRemovePriceRow = (index: number) => {
    const entry = prices[index];
    if (entry.id && !entry.isNew) {
      // Mark for deletion
      setPrices(prices.map((p, i) => i === index ? { ...p, toDelete: true } : p));
    } else {
      // Remove from array
      setPrices(prices.filter((_, i) => i !== index));
    }
  };

  const handlePriceChange = (index: number, field: 'unit' | 'price', value: string) => {
    setPrices(prices.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const activePrices = prices.filter(p => !p.toDelete);
    const hasValidPrice = activePrices.some(p => p.price && Number(p.price) >= 0);
    
    if (!name.trim() || !hasValidPrice || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing && onUpdate && editingVegetable) {
        // Update vegetable basic info
        const firstPrice = activePrices[0];
        await onUpdate(editingVegetable.id, {
          name: name.trim(),
          unit: firstPrice?.unit || '斤',
          price: Number(firstPrice?.price) || 0,
          status,
          note: note.trim() || null,
          tag: tag.trim() || null,
          supplier: supplier.trim() || null,
          is_wholesale: isWholesale,
        });

        // Handle price updates
        for (const p of prices) {
          if (p.toDelete && p.id && onDeletePrice) {
            await onDeletePrice(p.id, editingVegetable.id);
          } else if (p.isNew && p.price && onAddPrice) {
            await onAddPrice(editingVegetable.id, p.unit, Number(p.price));
          } else if (p.id && !p.isNew && p.price && onUpdatePrice) {
            await onUpdatePrice(p.id, editingVegetable.id, p.unit, Number(p.price));
          }
        }
      } else {
        // Create new vegetable (first price is stored in vegetables table)
        const firstPrice = activePrices[0];
        await onAdd({
          name: name.trim(),
          unit: firstPrice?.unit || '斤',
          price: Number(firstPrice?.price) || 0,
          status,
          note: note.trim() || null,
          tag: tag.trim() || null,
          supplier: supplier.trim() || null,
          is_wholesale: isWholesale,
        });
      }
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePrices = prices.filter(p => !p.toDelete);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center">
      <div className="w-full max-w-md animate-slide-up rounded-t-2xl bg-card p-6 shadow-lg sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            {isEditing ? '編輯品項' : '新增品項'}
          </h2>
          <button
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              菜名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：高麗菜"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
              autoFocus
            />
          </div>

          {/* Multiple Prices Section */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              價格 <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {activePrices.map((priceEntry, index) => {
                const actualIndex = prices.findIndex(p => p === priceEntry);
                return (
                  <div key={actualIndex} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={priceEntry.price}
                        onChange={(e) => handlePriceChange(actualIndex, 'price', e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full rounded-lg border border-input bg-background py-2.5 pl-7 pr-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        required={index === 0}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {PRESET_UNITS.map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => handlePriceChange(actualIndex, 'unit', u)}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            priceEntry.unit === u 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                      <input
                        type="text"
                        value={priceEntry.unit}
                        onChange={(e) => handlePriceChange(actualIndex, 'unit', e.target.value)}
                        placeholder="自訂"
                        maxLength={20}
                        className="w-14 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    {activePrices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePriceRow(actualIndex)}
                        className="p-2 text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleAddPriceRow}
              className="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary/80"
            >
              <Plus className="h-4 w-4" />
              新增其他單位/價格
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">狀態</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatus('in_stock')}
                className={`flex-1 rounded-lg border-2 py-3 font-medium transition-all ${
                  status === 'in_stock'
                    ? 'border-success bg-success/10 text-success'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                供貨中
              </button>
              <button
                type="button"
                onClick={() => setStatus('out_of_stock')}
                className={`flex-1 rounded-lg border-2 py-3 font-medium transition-all ${
                  status === 'out_of_stock'
                    ? 'border-unavailable bg-unavailable/10 text-unavailable-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                缺貨
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">標籤（選填，僅管理員可見）</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Combobox
                  value={tag}
                  onValueChange={setTag}
                  options={existingTags}
                  placeholder="選擇或新增標籤..."
                  emptyText="沒有標籤"
                />
              </div>
              {tag && (
                <button
                  type="button"
                  onClick={() => setTag('')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">供貨商（選填，僅管理員可見）</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Combobox
                  value={supplier}
                  onValueChange={setSupplier}
                  options={existingSuppliers}
                  placeholder="選擇或新增供貨商..."
                  emptyText="沒有供貨商"
                />
              </div>
              {supplier && (
                <button
                  type="button"
                  onClick={() => setSupplier('')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">備註（選填）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：限量、品質佳"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isWholesale}
                onChange={(e) => setIsWholesale(e.target.checked)}
                className="h-5 w-5 rounded border-input text-primary focus:ring-primary/20"
              />
              <span className="text-sm font-medium text-foreground">批發可談</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border py-3 font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              {isEditing ? '儲存' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
