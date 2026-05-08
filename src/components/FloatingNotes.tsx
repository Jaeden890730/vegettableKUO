import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { StickyNote, X, Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AdminNote = {
  id: string;
  type: 'note' | 'todo';
  title: string | null;
  content: string | null;
  is_done: boolean;
  created_at: string;
};

const FloatingNotes = () => {
  const { isAdmin, isLoading, isAuthenticated } = useSupabaseAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'note' | 'todo'>('note');
  const [items, setItems] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_notes')
      .select('*')
      .order('is_done', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('載入失敗');
    } else {
      setItems((data || []) as AdminNote[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && isAdmin) load();
  }, [open, isAdmin, load]);

  if (isLoading || !isAuthenticated || !isAdmin) return null;
  if (!location.pathname.startsWith('/admin')) return null;

  const filtered = items.filter(i => i.type === tab);

  const handleAdd = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title && !content) {
      toast.error('請輸入內容');
      return;
    }
    const { error } = await supabase.from('admin_notes').insert({
      type: tab,
      title: title || null,
      content: content || null,
    });
    if (error) {
      toast.error('新增失敗');
    } else {
      setNewTitle('');
      setNewContent('');
      load();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('admin_notes').delete().eq('id', id);
    if (error) toast.error('刪除失敗');
    else load();
  };

  const handleToggleDone = async (item: AdminNote) => {
    const { error } = await supabase
      .from('admin_notes')
      .update({ is_done: !item.is_done })
      .eq('id', item.id);
    if (error) toast.error('更新失敗');
    else load();
  };

  const startEdit = (item: AdminNote) => {
    setEditingId(item.id);
    setEditTitle(item.title || '');
    setEditContent(item.content || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from('admin_notes')
      .update({
        title: editTitle.trim() || null,
        content: editContent.trim() || null,
      })
      .eq('id', editingId);
    if (error) {
      toast.error('儲存失敗');
    } else {
      setEditingId(null);
      load();
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[9999] w-80 max-w-[calc(100vw-2rem)] max-h-[80vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-bold">備忘錄</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                tab === 'note' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
              )}
              onClick={() => setTab('note')}
            >
              筆記
            </button>
            <button
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                tab === 'todo' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
              )}
              onClick={() => setTab('todo')}
            >
              待辦
            </button>
          </div>

          {/* Add form */}
          <div className="p-3 border-b border-border space-y-2">
            {tab === 'note' && (
              <Input
                placeholder="標題（可選）"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="h-8 text-sm"
              />
            )}
            <Textarea
              placeholder={tab === 'note' ? '內容...' : '新增待辦事項...'}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="min-h-[60px] text-sm resize-none"
              rows={tab === 'note' ? 3 : 2}
            />
            <Button size="sm" className="w-full h-8" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />
              新增
            </Button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
            {loading && <div className="text-center text-xs text-muted-foreground py-4">載入中...</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">還沒有{tab === 'note' ? '筆記' : '待辦'}</div>
            )}
            {filtered.map(item => (
              <div
                key={item.id}
                className={cn(
                  'border border-border rounded-lg p-2 text-sm group',
                  item.is_done && 'opacity-50'
                )}
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    {tab === 'note' && (
                      <Input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="h-7 text-sm"
                        placeholder="標題"
                      />
                    )}
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="min-h-[50px] text-sm resize-none"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 flex-1" onClick={saveEdit}>儲存</Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    {tab === 'todo' && (
                      <button
                        onClick={() => handleToggleDone(item)}
                        className={cn(
                          'mt-0.5 h-4 w-4 rounded border border-input flex items-center justify-center shrink-0',
                          item.is_done && 'bg-primary border-primary'
                        )}
                      >
                        {item.is_done && <Check className="h-3 w-3 text-primary-foreground" />}
                      </button>
                    )}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => startEdit(item)}
                    >
                      {item.title && (
                        <div className={cn('font-medium truncate', item.is_done && 'line-through')}>
                          {item.title}
                        </div>
                      )}
                      {item.content && (
                        <div className={cn('text-xs text-muted-foreground whitespace-pre-wrap break-words', item.is_done && 'line-through')}>
                          {item.content}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 z-[9999] h-12 w-12 rounded-full bg-amber-500 text-white shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform"
        aria-label="備忘錄"
      >
        <StickyNote className="h-5 w-5" />
      </button>
    </>
  );
};

export default FloatingNotes;
