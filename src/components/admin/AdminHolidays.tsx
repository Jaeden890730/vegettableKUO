import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, CalendarOff } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Holiday {
  id: string;
  holiday_date: string;
  note: string | null;
  created_at: string;
}

export default function AdminHolidays() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('holiday_dates')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast({
        title: '載入失敗',
        description: '無法載入休假日資料',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newDate) {
      toast({
        title: '請選擇日期',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('holiday_dates')
        .insert({
          holiday_date: newDate,
          note: newNote.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: '該日期已存在',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: '新增成功',
      });

      setNewDate('');
      setNewNote('');
      fetchHolidays();
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast({
        title: '新增失敗',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('holiday_dates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '刪除成功',
      });

      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast({
        title: '刪除失敗',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">休假日設定</h2>
        <p className="text-muted-foreground">管理店家休假日期，會顯示在首頁</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            休假日管理
          </CardTitle>
          <CardDescription>
            設定的休假日會顯示在首頁，提醒客戶
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Holiday */}
          <div className="space-y-3 pb-4 border-b">
            <div className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              新增休假日
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="newDate">日期</Label>
                <Input
                  id="newDate"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newNote">備註（選填）</Label>
                <Input
                  id="newNote"
                  placeholder="例如：春節"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddHoliday} disabled={isSaving || !newDate}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  新增
                </Button>
              </div>
            </div>
          </div>

          {/* Holiday List */}
          {holidays.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>星期</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => {
                  const date = new Date(holiday.holiday_date);
                  const isPast = date < new Date(new Date().toDateString());
                  return (
                    <TableRow key={holiday.id} className={isPast ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        {format(date, 'yyyy/MM/dd', { locale: zhTW })}
                      </TableCell>
                      <TableCell>
                        {format(date, 'EEEE', { locale: zhTW })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {holiday.note || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              尚未設定休假日
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
