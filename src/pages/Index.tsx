import { useState } from 'react';
import { Header } from '@/components/Header';
import { UpdateBanner } from '@/components/UpdateBanner';
import { WholesaleBanner } from '@/components/WholesaleBanner';
import { HolidayBanner } from '@/components/HolidayBanner';
import { VegetableList } from '@/components/VegetableList';
import { ContactSection } from '@/components/ContactSection';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { AddVegetableForm } from '@/components/AddVegetableForm';
import { BulkEditMode } from '@/components/BulkEditMode';
import { PrintFlyerButton } from '@/components/PrintFlyerButton';
import { useVegetables } from '@/hooks/useVegetables';
import { useAuth } from '@/hooks/useAuth';
import { Vegetable } from '@/types/vegetable';
import { Edit, Copy } from 'lucide-react';
import { VegetableListSkeleton } from '@/components/VegetableListSkeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVegetable, setEditingVegetable] = useState<Vegetable | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const { isAuthenticated, signOut, isLoading: authLoading } = useAuth();
  const isAdminMode = isAuthenticated;

  const {
    vegetables,
    visibleVegetables,
    tagOrders,
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
  } = useVegetables(isAdminMode);

  const handleLogout = () => {
    signOut();
    toast.success('已登出');
  };

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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[url('/bg-pattern.jpg')] bg-repeat bg-[length:200px_200px]">
      <div className="relative min-h-screen bg-gradient-to-b from-background/90 via-background/95 to-background">
      <Header 
        isAdminMode={isAdminMode} 
        onLogout={handleLogout}
      />
      
      <UpdateBanner 
        lastUpdated={lastUpdated} 
        isAdminMode={isAdminMode} 
      />
      
      {!isAdminMode && <WholesaleBanner />}
      
      {/* Holiday Banner - show for everyone */}
      <HolidayBanner />
      {/* Main content */}
      <main className="container py-4">
        {/* Top price disclaimer - only for non-admin */}
        {!isAdminMode && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 mb-3">
            <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
              ⚠️ 目前顯示價格為當下價格，實際價格以出貨日為準
            </p>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">今日菜價</h2>
          <div className="flex items-center gap-2">
            {isAdminMode && <PrintFlyerButton vegetables={visibleVegetables} />}
            {isAdminMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
                  const regularItems = visibleVegetables
                    .filter(v => v.status !== 'out_of_stock' && v.tag !== '預購')
                    .map((v, i) => {
                      const priceText = v.prices && v.prices.length > 0
                        ? v.prices.map(p => `${p.price}/${p.unit}`).join('、')
                        : `${v.price}/${v.unit}`;
                      return `${i + 1}.${v.name} ${priceText}`;
                    });
                  const preorderItems = visibleVegetables
                    .filter(v => v.tag === '預購' && v.status !== 'out_of_stock')
                    .map((v, i) => {
                      const priceText = v.prices && v.prices.length > 0
                        ? v.prices.map(p => `${p.price}/${p.unit}`).join('、')
                        : `${v.price}/${v.unit}`;
                      return `${i + 1}.${v.name} ${priceText}`;
                    });
                  let list = `${dateStr} 今日菜價\n${regularItems.join('\n')}`;
                  if (preorderItems.length > 0) {
                    list += `\n\n⏰ 預購區（前一天中午12:00前叫貨才有）\n${preorderItems.join('\n')}`;
                  }
                  navigator.clipboard.writeText(list);
                  toast.success('已複製菜價清單');
                }}
                className="gap-1"
              >
                <Copy className="h-3.5 w-3.5" />
                複製菜價
              </Button>
            )}
            {isAdminMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkEdit(true)}
                className="gap-1"
              >
                <Edit className="h-3.5 w-3.5" />
                全部編輯
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              共 {isAdminMode ? vegetables.length : visibleVegetables.length} 項
            </span>
          </div>
        </div>

        {isLoading ? (
          <VegetableListSkeleton />
        ) : (
          <VegetableList
            vegetables={isAdminMode ? vegetables : visibleVegetables}
            isAdminMode={isAdminMode}
            onToggleStatus={toggleStatus}
            onToggleVisibility={toggleVisibility}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onReorder={reorderVegetables}
            tagOrders={tagOrders}
          />
        )}

        {/* Bottom price disclaimer - only for non-admin */}
        {!isAdminMode && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 mt-3">
            <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
              ⚠️ 目前顯示價格為當下價格，實際價格以出貨日為準
            </p>
          </div>
        )}
      </main>

      <ContactSection />

      {/* Admin mode floating button */}
      {isAdminMode && (
        <FloatingAddButton onClick={() => setShowAddForm(true)} />
      )}

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
    </div>
  );
};

export default Index;
