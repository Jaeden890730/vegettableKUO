import { useState, useEffect, useMemo } from 'react';
import { useTagOrders } from '@/hooks/useTagOrders';
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

interface TagItem {
  id: string;
  tag_name: string;
  sort_order: number;
  count: number;
}

function SortableTagItem({ tag, onRemove }: { tag: TagItem; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

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
      <span className="text-sm font-medium flex-1">{tag.tag_name}</span>
      <Badge variant="secondary" className="text-xs">{tag.count} 項</Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(tag.id)}
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function AdminTagOrders() {
  const { tagOrders, isLoading: tagLoading, saveTagOrders } = useTagOrders();
  const { vegetables } = useVegetables(true);
  const [items, setItems] = useState<TagItem[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  // Get all unique tags from vegetables
  const allTags = useMemo(() => {
    const tags = vegetables.map(v => v.tag).filter((t): t is string => !!t);
    return [...new Set(tags)];
  }, [vegetables]);

  // Count per tag
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    vegetables.forEach(v => {
      if (v.tag) {
        counts[v.tag] = (counts[v.tag] || 0) + 1;
      }
    });
    return counts;
  }, [vegetables]);

  // Initialize items from tagOrders + any tags in vegetables not yet in tagOrders
  useEffect(() => {
    const ordered: TagItem[] = tagOrders.map(to => ({
      id: to.id,
      tag_name: to.tag_name,
      sort_order: to.sort_order,
      count: tagCounts[to.tag_name] || 0,
    }));

    // Add tags from vegetables that aren't in tag_orders yet
    const existingNames = new Set(tagOrders.map(t => t.tag_name));
    const missing = allTags
      .filter(t => !existingNames.has(t))
      .map((t, i) => ({
        id: `new-${t}`,
        tag_name: t,
        sort_order: ordered.length + i,
        count: tagCounts[t] || 0,
      }));

    setItems([...ordered, ...missing]);
  }, [tagOrders, allTags, tagCounts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (items.some(i => i.tag_name === trimmed)) {
      toast.error('標籤已存在');
      return;
    }
    setItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      tag_name: trimmed,
      sort_order: prev.length,
      count: tagCounts[trimmed] || 0,
    }]);
    setNewTag('');
  };

  const handleRemove = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = items.map((item, index) => ({
        tag_name: item.tag_name,
        sort_order: index,
      }));
      await saveTagOrders(tags);
      toast.success('標籤排序已儲存');
    } catch {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (tagLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const untaggedCount = vegetables.filter(v => !v.tag).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">標籤排序管理</h2>
          <p className="text-sm text-muted-foreground">
            拖拽調整標籤順序，首頁品項將依此順序分組顯示
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          儲存排序
        </Button>
      </div>

      {/* Add new tag */}
      <div className="mb-4 flex items-center gap-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="新增標籤..."
          className="w-48 h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
        />
        <Button variant="outline" size="sm" onClick={handleAddTag} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          新增
        </Button>
      </div>

      {/* Sortable tag list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(tag => (
              <SortableTagItem key={tag.id} tag={tag} onRemove={handleRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Untagged info */}
      {untaggedCount > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          未分類品項：{untaggedCount} 項（將排在最後顯示）
        </div>
      )}
    </div>
  );
}
