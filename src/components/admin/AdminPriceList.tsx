import { useState } from 'react';
import { useRetailVegetables } from '@/hooks/useRetailVegetables';
import { VegetableList } from '@/components/VegetableList';
import { AddVegetableForm } from '@/components/AddVegetableForm';
import { BulkEditMode } from '@/components/BulkEditMode';
import { PrintFlyerButton } from '@/components/PrintFlyerButton';
import { Vegetable } from '@/types/vegetable';
import { Loader2, Edit, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function AdminPriceList() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVegetable, setEditingVegetable] = useState<Vegetable | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('https://fresh-daily-deal.lovable.app');

  const {
    vegetables,
    visibleVegetables,
    lastUpdated,
    isLoading,
    addVegetable,
    updateVegetable,
    deleteVegetable,
    addPrice,
    updatePrice,
    deletePrice,
    toggleStatus,
    toggleVisibility,
    moveUp,
    moveDown,
    reorderVegetables,
    bulkUpdateVegetables,
  } = useRetailVegetables();

  const handleEdit = (vegetable: Vegetable) => {
    setEditingVegetable(vegetable);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingVegetable(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除此品項嗎？')) {
      try {
        await deleteVegetable(id);
        toast.success('已刪除');
      } catch {
        toast.error('刪除失敗');
      }
    }
  };

  const handleAdd = async (vegetable: Omit<Vegetable, 'id' | 'sort_order' | 'updated_at' | 'created_at'>) => {
    try {
      await addVegetable(vegetable);
      toast.success('新增成功');
    } catch {
      toast.error('新增失敗');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Vegetable>) => {
    try {
      await updateVegetable(id, updates);
      toast.success('更新成功');
    } catch {
      toast.error('更新失敗');
    }
  };

  const handleBulkSave = async (items: { id: string; prices: { id: string; price: number; unit: string }[] }[]) => {
    try {
      await bulkUpdateVegetables(items);
      toast.success(`已更新 ${items.length} 個品項`);
    } catch {
      toast.error('批量更新失敗');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header area */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">菜價展示</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              最後更新：{format(lastUpdated, 'yyyy/MM/dd HH:mm', { locale: zhTW })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="qrCodeUrl" className="text-sm whitespace-nowrap">QR CODE：</Label>
            <Input
              id="qrCodeUrl"
              value={qrCodeUrl}
              onChange={(e) => setQrCodeUrl(e.target.value)}
              placeholder="輸入 QR Code 網址"
              className="w-64 h-8 text-sm"
            />
          </div>
          <PrintFlyerButton vegetables={visibleVegetables} qrCodeUrl={qrCodeUrl} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkEdit(true)}
            className="gap-1"
          >
            <Edit className="h-3.5 w-3.5" />
            全部編輯
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            新增品項
          </Button>
          <span className="text-sm text-muted-foreground">共 {vegetables.length} 項</span>
        </div>
      </div>

      {/* Vegetable list - admin mode */}
      <VegetableList
        vegetables={vegetables}
        isAdminMode={true}
        onToggleStatus={toggleStatus}
        onToggleVisibility={toggleVisibility}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onReorder={reorderVegetables}
      />

      {/* Add/Edit form modal */}
      {showAddForm && (
        <AddVegetableForm
          onAdd={handleAdd}
          onCancel={handleCloseForm}
          editingVegetable={editingVegetable}
          onUpdate={handleUpdate}
          onAddPrice={addPrice}
          onUpdatePrice={updatePrice}
          onDeletePrice={deletePrice}
          existingTags={[...new Set(vegetables.map(v => v.tag).filter((t): t is string => !!t))]}
          existingSuppliers={[...new Set(vegetables.map(v => v.supplier).filter((s): s is string => !!s))]}
        />
      )}

      {/* Bulk Edit Mode */}
      {showBulkEdit && (
        <BulkEditMode
          vegetables={vegetables}
          onSave={handleBulkSave}
          onClose={() => setShowBulkEdit(false)}
        />
      )}
    </div>
  );
}
