import { useState, useEffect } from 'react';
import { Vegetable } from '@/types/vegetable';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BulkEditModeProps {
  vegetables: Vegetable[];
  onSave: (items: { id: string; prices: { id: string; price: number; unit: string }[] }[]) => Promise<void>;
  onClose: () => void;
}

interface EditablePrice {
  id: string;
  price: string;
  unit: string;
}

interface EditableVegetable {
  id: string;
  name: string;
  prices: EditablePrice[];
}

export function BulkEditMode({ vegetables, onSave, onClose }: BulkEditModeProps) {
  const [editableItems, setEditableItems] = useState<EditableVegetable[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 初始化可編輯狀態
    const items = vegetables
      .filter(v => v.status !== 'hidden')
      .map(v => ({
        id: v.id,
        name: v.name,
        prices: v.prices.length > 0 
          ? v.prices.map(p => ({ id: p.id, price: String(p.price), unit: p.unit }))
          : [{ id: 'main', price: String(v.price), unit: v.unit }]
      }));
    setEditableItems(items);
  }, [vegetables]);

  const handlePriceChange = (vegId: string, priceId: string, value: string) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id === vegId) {
        return {
          ...item,
          prices: item.prices.map(p => 
            p.id === priceId ? { ...p, price: value } : p
          )
        };
      }
      return item;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const items = editableItems
        .filter(item => item.prices.some(p => p.id !== 'main')) // 只處理有 prices 表記錄的
        .map(item => ({
          id: item.id,
          prices: item.prices
            .filter(p => p.id !== 'main')
            .map(p => ({
              id: p.id,
              price: parseFloat(p.price) || 0,
              unit: p.unit,
            }))
        }))
        .filter(item => item.prices.length > 0);
      
      await onSave(items);
      onClose();
    } catch (error) {
      console.error('Bulk save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-bold text-foreground">批量編輯價格</h2>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          儲存全部
        </Button>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm text-muted-foreground mb-3">
          修改下方價格後，點擊「儲存全部」一次更新所有品項
        </p>

        <div className="space-y-2">
          {editableItems.map(item => (
            <div 
              key={item.id}
              className="flex items-center gap-2 p-2 bg-card border border-border rounded-lg"
            >
              <span className="font-medium text-foreground min-w-[80px] truncate flex-shrink-0">
                {item.name}
              </span>
              <div className="flex flex-wrap gap-2 flex-1">
                {item.prices.map(price => (
                  <div key={price.id} className="flex items-center gap-1">
                    <span className="text-primary font-bold">$</span>
                    <Input
                      type="number"
                      value={price.price}
                      onChange={(e) => handlePriceChange(item.id, price.id, e.target.value)}
                      className="w-16 h-8 text-center px-1"
                    />
                    <span className="text-xs text-muted-foreground">/{price.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
