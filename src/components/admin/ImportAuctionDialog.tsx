import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAccounting } from '@/hooks/useAccounting';

interface ParsedRow {
  id: string;
  entry_date: string; // yyyy-MM-dd
  item_name: string;
  quantity: number; // 淨重
  unit_price: number;
  amount: number;
  note: string;
}

// 民國日期 115/04/21 -> 西元 2026-04-21
const convertRocDate = (rocStr: string): string | null => {
  const m = String(rocStr).trim().match(/^(\d{2,3})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10) + 1911;
  const month = m[2].padStart(2, '0');
  const day = m[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ImportAuctionDialog() {
  const { createBulkEntries } = useAccounting();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

      // 找到標題列(包含 "單據日期")
      let headerIdx = -1;
      let cols: Record<string, number> = {};
      for (let i = 0; i < data.length; i++) {
        const row = data[i] || [];
        const idx = row.findIndex((c) => String(c ?? '').includes('單據日期'));
        if (idx !== -1) {
          headerIdx = i;
          row.forEach((c, j) => {
            const key = String(c ?? '').trim();
            if (key) cols[key] = j;
          });
          break;
        }
      }
      if (headerIdx === -1) {
        toast.error('找不到標題列(單據日期)');
        return;
      }

      const dateCol = cols['單據日期'];
      const nameCol = cols['品名'];
      const weightCol = cols['淨重'];
      const priceCol = cols['單價'];
      const specCol = cols['規格'];
      const gradeCol = cols['等級'];

      if (dateCol === undefined || nameCol === undefined || weightCol === undefined || priceCol === undefined) {
        toast.error('檔案缺少必要欄位(單據日期/品名/淨重/單價)');
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every((c) => c === null || c === '')) continue;
        const rocDate = row[dateCol];
        if (!rocDate) continue;
        const date = convertRocDate(String(rocDate));
        if (!date) continue;
        const name = String(row[nameCol] ?? '').trim();
        const weight = Number(row[weightCol]);
        const price = Number(row[priceCol]);
        if (!name || !isFinite(weight) || !isFinite(price)) continue;

        const specParts = [
          specCol !== undefined ? row[specCol] : null,
          gradeCol !== undefined ? row[gradeCol] : null,
        ].filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
        const note = specParts.length ? `規格/等級: ${specParts.join(' / ')}` : '';

        parsed.push({
          id: `${i}-${Math.random().toString(36).slice(2, 7)}`,
          entry_date: date,
          item_name: name,
          quantity: weight,
          unit_price: price,
          amount: Math.round(weight * price),
          note,
        });
      }

      if (parsed.length === 0) {
        toast.error('未解析到有效資料');
        return;
      }

      setRows(parsed);
      setFileName(file.name);
      toast.success(`已解析 ${parsed.length} 筆資料,請確認後匯入`);
    } catch (err) {
      console.error(err);
      toast.error('讀取檔案失敗');
    }
  };

  const updateRow = (id: string, patch: Partial<ParsedRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        next.amount = Math.round(next.quantity * next.unit_price);
        return next;
      })
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = async () => {
    if (rows.length === 0) {
      toast.error('沒有資料可匯入');
      return;
    }
    setIsSubmitting(true);
    try {
      const entries = rows.map((r) => ({
        entry_date: r.entry_date,
        entry_type: 'purchase' as const,
        category: '進貨',
        item_name: r.item_name,
        quantity: r.quantity,
        unit: '公斤',
        unit_price: r.unit_price,
        amount: r.amount,
        note: r.note || undefined,
      }));
      const { error } = await createBulkEntries(entries);
      if (error) throw error;
      toast.success(`成功匯入 ${entries.length} 筆進貨記錄`);
      setRows([]);
      setFileName('');
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('匯入失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setFileName(''); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1">
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          匯入拍賣
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>匯入拍賣交易資料</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex-1">
              <input
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md py-4 cursor-pointer hover:bg-accent">
                <Upload className="h-4 w-4" />
                <span className="text-sm">{fileName || '選擇 Excel 檔 (.xls / .xlsx)'}</span>
              </div>
            </label>
          </div>

          {rows.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                共 {rows.length} 筆,總金額 ${totalAmount.toLocaleString()} (分類: 進貨 / 單位: 公斤)
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">日期</TableHead>
                      <TableHead>品名</TableHead>
                      <TableHead className="w-24">淨重(公斤)</TableHead>
                      <TableHead className="w-24">單價</TableHead>
                      <TableHead className="w-28 text-right">小計</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.entry_date}
                            onChange={(e) => updateRow(r.id, { entry_date: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.item_name}
                            onChange={(e) => updateRow(r.id, { item_name: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={r.quantity}
                            onChange={(e) => updateRow(r.id, { quantity: Number(e.target.value) })}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={r.unit_price}
                            onChange={(e) => updateRow(r.id, { unit_price: Number(e.target.value) })}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${r.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeRow(r.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRows([]); setFileName(''); }}>
                  清空
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? '匯入中...' : `確認匯入 ${rows.length} 筆`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
