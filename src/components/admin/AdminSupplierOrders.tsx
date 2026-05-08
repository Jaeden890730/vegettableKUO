import { useState, useEffect, useMemo } from 'react';
import { useSupplierOrders } from '@/hooks/useSupplierOrders';
import { useVegetables } from '@/hooks/useVegetables';
import { Button } from '@/components/ui/button';
import { Loader2, GripVertical, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SupplierItem {
  id: string;
  supplier_name: string;
  sort_order: number;
  count: number;
}

function SortableSupplierItem({
  item,
  onRemove,
}: {
  item: SupplierItem;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-sm font-medium flex-1">{item.supplier_name}</span>
      <Badge variant="secondary" className="text-xs">{item.count} 項</Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(item.id)}
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function AdminSupplierOrders() {
  const { supplierOrders, isLoading, saveSupplierOrders } = useSupplierOrders();
  const { vegetables } = useVegetables(true);
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [newSupplier, setNewSupplier] = useState('');
  const [saving, setSaving] = useState(false);

  const allSuppliers = useMemo(() => {
    const set = vegetables
      .map((v) => (v as any).supplier as string | null | undefined)
      .filter((s): s is string => !!s && s.trim() !== '');
    return [...new Set(set)];
  }, [vegetables]);

  const supplierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    vegetables.forEach((v) => {
      const sup = (v as any).supplier as string | null | undefined;
      if (sup) counts[sup] = (counts[sup] || 0) + 1;
    });
    return counts;
  }, [vegetables]);

  useEffect(() => {
    const ordered: SupplierItem[] = supplierOrders.map((s) => ({
      id: s.id,
      supplier_name: s.supplier_name,
      sort_order: s.sort_order,
      count: supplierCounts[s.supplier_name] || 0,
    }));

    const existingNames = new Set(supplierOrders.map((s) => s.supplier_name));
    const missing = allSuppliers
      .filter((s) => !existingNames.has(s))
      .map((s, i) => ({
        id: `new-${s}`,
        supplier_name: s,
        sort_order: ordered.length + i,
        count: supplierCounts[s] || 0,
      }));

    setItems([...ordered, ...missing]);
  }, [supplierOrders, allSuppliers, supplierCounts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    const trimmed = newSupplier.trim();
    if (!trimmed) return;
    if (items.some((i) => i.supplier_name === trimmed)) {
      toast.error('供貨商已存在');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        supplier_name: trimmed,
        sort_order: prev.length,
        count: supplierCounts[trimmed] || 0,
      },
    ]);
    setNewSupplier('');
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const suppliers = items.map((item, index) => ({
        supplier_name: item.supplier_name,
        sort_order: index,
      }));
      await saveSupplierOrders(suppliers);
      toast.success('供貨商排序已儲存');
    } catch {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const noSupplierCount = vegetables.filter(
    (v) => !(v as any).supplier || ((v as any).supplier as string).trim() === ''
  ).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">供貨商排序管理</h2>
          <p className="text-sm text-muted-foreground">
            拖拽調整供貨商順序，當日統計品項將依此順序排列
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          儲存排序
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Input
          value={newSupplier}
          onChange={(e) => setNewSupplier(e.target.value)}
          placeholder="新增供貨商..."
          className="w-48 h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          新增
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableSupplierItem key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {noSupplierCount > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          未指定供貨商品項：{noSupplierCount} 項（將排在最後顯示）
        </div>
      )}
    </div>
  );
}
