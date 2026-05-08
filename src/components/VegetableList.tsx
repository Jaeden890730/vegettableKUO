import { Vegetable } from '@/types/vegetable';
import { Clock } from 'lucide-react';
import { VegetableRow } from './VegetableRow';
import { Package, GripVertical } from 'lucide-react';
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
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VegetableListProps {
  vegetables: Vegetable[];
  isAdminMode: boolean;
  onToggleStatus: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (vegetable: Vegetable) => void;
  onReorder?: (activeId: string, overId: string) => void;
  tagOrders?: { tag_name: string; sort_order: number }[];
}

interface SortableRowProps {
  vegetable: Vegetable;
  isAdminMode: boolean;
  onToggleStatus: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (vegetable: Vegetable) => void;
  isFirst: boolean;
  isLast: boolean;
}

function SortableRow({
  vegetable,
  isAdminMode,
  onToggleStatus,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
  isFirst,
  isLast,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: vegetable.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isAdminMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={isAdminMode ? 'pl-6' : ''}>
        <VegetableRow
          vegetable={vegetable}
          isAdminMode={isAdminMode}
          onToggleStatus={onToggleStatus}
          onToggleVisibility={onToggleVisibility}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          onEdit={onEdit}
          isFirst={isFirst}
          isLast={isLast}
        />
      </div>
    </div>
  );
}

export function VegetableList({
  vegetables,
  isAdminMode,
  onToggleStatus,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
  onReorder,
  tagOrders = [],
}: VegetableListProps) {
  // Sort by: tag order first, then sort_order within each tag
  const displayVegetables = (() => {
    const sorted = [...vegetables];
    const statusOrder = (s: string) => s === 'hidden' ? 2 : s === 'out_of_stock' ? 1 : 0;
    if (tagOrders.length > 0) {
      const tagOrderMap = new Map(tagOrders.map((t, i) => [t.tag_name, t.sort_order]));
      const maxTagOrder = Math.max(...tagOrders.map(t => t.sort_order)) + 1;
      sorted.sort((a, b) => {
        const aStatus = statusOrder(a.status);
        const bStatus = statusOrder(b.status);
        if (aStatus !== bStatus) return aStatus - bStatus;
        const tagA = tagOrderMap.get(a.tag || '') ?? maxTagOrder;
        const tagB = tagOrderMap.get(b.tag || '') ?? maxTagOrder;
        if (tagA !== tagB) return tagA - tagB;
        return a.sort_order - b.sort_order;
      });
    } else {
      sorted.sort((a, b) => {
        const aStatus = statusOrder(a.status);
        const bStatus = statusOrder(b.status);
        if (aStatus !== bStatus) return aStatus - bStatus;
        return a.sort_order - b.sort_order;
      });
    }
    return sorted;
  })();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id && onReorder) {
      onReorder(active.id as string, over.id as string);
    }
  };

  if (displayVegetables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 shadow-inner">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-semibold text-lg text-foreground">尚無菜價資料</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isAdminMode ? '點擊右下角「+」開始新增' : '請稍後再來查看'}
        </p>
      </div>
    );
  }

  const inStockItems = displayVegetables.filter(v => v.status === 'in_stock');
  const outOfStockItems = displayVegetables.filter(v => v.status === 'out_of_stock');

  // Group in-stock items by tag
  const groupedInStock = (() => {
    if (tagOrders.length === 0) {
      return [{ tag: null, items: inStockItems }];
    }
    const groups: { tag: string | null; items: Vegetable[] }[] = [];
    const tagMap = new Map<string | null, Vegetable[]>();

    inStockItems.forEach(v => {
      const key = v.tag || null;
      if (!tagMap.has(key)) tagMap.set(key, []);
      tagMap.get(key)!.push(v);
    });

    // Add groups in tag order
    tagOrders.forEach(to => {
      const items = tagMap.get(to.tag_name);
      if (items && items.length > 0) {
        groups.push({ tag: to.tag_name, items });
        tagMap.delete(to.tag_name);
      }
    });

    // Add remaining untagged/unordered
    tagMap.forEach((items, tag) => {
      if (items.length > 0) {
        groups.push({ tag, items });
      }
    });

    return groups;
  })();

  // Flatten grouped items into a single sorted list for non-admin
  const sortedInStock = groupedInStock.flatMap(g => g.items);

  if (!isAdminMode) {
    return (
      <div className="space-y-4">
        {/* In stock section */}
        {sortedInStock.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground/80">供貨中</h3>
            <span className="text-xs text-muted-foreground">({sortedInStock.length} 項)</span>
          </div>
        )}
        {groupedInStock.map((group, groupIdx) => (
          <div key={group.tag || `untagged-${groupIdx}`}>
            {/* Tag group header - only show for tagged groups when there are multiple groups */}
            {group.tag && groupedInStock.length > 1 && (
              <div className="mt-3 first:mt-0 mb-2">
                {group.tag === '預購' ? (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2 mb-2">
                    <div className="flex items-center gap-1.5 justify-center">
                      <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        以下品項需前一天中午 12:00 前叫貨才有
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {group.items.map((vegetable, index) => (
                <VegetableRow
                  key={vegetable.id}
                  vegetable={vegetable}
                  isAdminMode={isAdminMode}
                  onToggleStatus={onToggleStatus}
                  onToggleVisibility={onToggleVisibility}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  isFirst={index === 0}
                  isLast={index === group.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Out of stock section */}
        {outOfStockItems.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-unavailable" />
              <h3 className="text-sm font-semibold text-muted-foreground">缺貨中</h3>
              <span className="text-xs text-muted-foreground">({outOfStockItems.length} 項)</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {outOfStockItems.map((vegetable, index) => (
                <VegetableRow
                  key={vegetable.id}
                  vegetable={vegetable}
                  isAdminMode={isAdminMode}
                  onToggleStatus={onToggleStatus}
                  onToggleVisibility={onToggleVisibility}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  isFirst={index === 0}
                  isLast={index === outOfStockItems.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Group admin vegetables for tag headers
  const adminGroups = (() => {
    const groups: { tag: string | null; items: Vegetable[] }[] = [];
    const tagMap = new Map<string | null, Vegetable[]>();

    displayVegetables.forEach(v => {
      const key = v.tag || null;
      if (!tagMap.has(key)) tagMap.set(key, []);
      tagMap.get(key)!.push(v);
    });

    // Add groups in tag order
    tagOrders.forEach(to => {
      const items = tagMap.get(to.tag_name);
      if (items && items.length > 0) {
        groups.push({ tag: to.tag_name, items });
        tagMap.delete(to.tag_name);
      }
    });

    // Add remaining untagged/unordered
    tagMap.forEach((items, tag) => {
      if (items.length > 0) {
        groups.push({ tag, items });
      }
    });

    return groups;
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={displayVegetables.map(v => v.id)}
        strategy={rectSortingStrategy}
      >
        <div className="space-y-3">
          {adminGroups.map((group, groupIdx) => (
            <div key={group.tag || `untagged-${groupIdx}`}>
              {group.tag === '預購' && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2 mb-2">
                  <div className="flex items-center gap-1.5 justify-center">
                    <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      預購區 這些價格必須前一天中午 12:00 前叫貨才有
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((vegetable, index) => (
                  <SortableRow
                    key={vegetable.id}
                    vegetable={vegetable}
                    isAdminMode={isAdminMode}
                    onToggleStatus={onToggleStatus}
                    onToggleVisibility={onToggleVisibility}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    isFirst={index === 0}
                    isLast={index === group.items.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
