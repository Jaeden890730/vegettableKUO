import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Line {
  id: number;
  qty: number;
  unit: '公斤' | '台斤';
}

interface CompanyLine {
  id: number;
  pricePerKg: number;
  qty: number;
}

interface MiscLine {
  id: number;
  name: string;
  amount: number;
  qty: number;
}

let lineIdCounter = 0;
const nextId = () => ++lineIdCounter;

const parseNum = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
};

const parseSignedNum = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export default function AdminCalculator() {
  const { toast } = useToast();

  // 玉米筍
  const [babyCornPrice, setBabyCornPrice] = useState(0);
  const [babyCornLines, setBabyCornLines] = useState<Line[]>([{ id: nextId(), qty: 0, unit: '公斤' }]);

  // 玉米
  const [cornPrice, setCornPrice] = useState(0);
  const [cornLines, setCornLines] = useState<Line[]>([{ id: nextId(), qty: 0, unit: '公斤' }]);

  // 公司玉米
  const [companyLines, setCompanyLines] = useState<CompanyLine[]>([{ id: nextId(), pricePerKg: 0, qty: 0 }]);

  // 雜項（可負數，代表付出去的錢）
  const [miscLines, setMiscLines] = useState<MiscLine[]>([{ id: nextId(), name: '', amount: 0, qty: 1 }]);

  const calcLineTotal = (price: number, qty: number, unit: string) =>
    unit === '台斤' ? price * qty * 0.6 : price * qty;

  const babyCornSubtotal = useMemo(
    () => babyCornLines.reduce((s, l) => s + calcLineTotal(babyCornPrice, l.qty, l.unit), 0),
    [babyCornPrice, babyCornLines]
  );

  const cornSubtotal = useMemo(
    () => cornLines.reduce((s, l) => s + calcLineTotal(cornPrice, l.qty, l.unit), 0),
    [cornPrice, cornLines]
  );

  const companySubtotal = useMemo(
    () => companyLines.reduce((s, l) => s + l.pricePerKg * l.qty * 1.02, 0),
    [companyLines]
  );

  const miscSubtotal = useMemo(
    () => miscLines.reduce((s, l) => s + l.amount * l.qty, 0),
    [miscLines]
  );

  const grandTotal = Math.round(babyCornSubtotal + cornSubtotal + companySubtotal + miscSubtotal);

  const updateLine = <T extends { id: number }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: number,
    patch: Partial<T>
  ) => setter(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const removeLine = <T extends { id: number }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: number
  ) => setter(prev => (prev.length <= 1 ? prev : prev.filter(l => l.id !== id)));

  // 鍵盤快捷鍵：Enter 新增一列，Ctrl/Shift+Delete 清空當列
  const makeKeyHandler = <T extends { id: number }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: number,
    addNew: () => T,
    clearPatch: Partial<T>
  ) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setter(prev => {
        const idx = prev.findIndex(l => l.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next.splice(idx + 1, 0, addNew());
        return next;
      });
    } else if (e.key === 'Delete' && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      setter(prev => prev.map(l => (l.id === id ? { ...l, ...clearPatch } : l)));
    }
  };

  const copyText = useCallback(() => {
    const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString()}`;
    const fmtLine = (price: number, l: { qty: number; unit: string }) => {
      const lt = calcLineTotal(price, l.qty, l.unit);
      return `  ${l.qty} ${l.unit} → ${fmt(lt)}`;
    };

    const lines = [
      `【玉米筍】單價 ${babyCornPrice}/公斤`,
      ...babyCornLines.map(l => fmtLine(babyCornPrice, l)),
      `  小計：${fmt(babyCornSubtotal)}`,
      '',
      `【玉米】單價 ${cornPrice}/公斤`,
      ...cornLines.map(l => fmtLine(cornPrice, l)),
      `  小計：${fmt(cornSubtotal)}`,
      '',
      '【公司傳票】含稅 x1.02',
      ...companyLines.map(l => `  單價 ${l.pricePerKg}/公斤 x ${l.qty}公斤 → ${fmt(l.pricePerKg * l.qty * 1.02)}`),
      `  小計：${fmt(companySubtotal)}`,
      '',
      '【雜項】',
      ...miscLines.map(l => `  ${l.name || '(未命名)'} ${l.amount} x ${l.qty} → ${fmt(l.amount * l.qty)}`),
      `  小計：${fmt(miscSubtotal)}`,
      '',
      `═══ 總計：${fmt(grandTotal)} ═══`,
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    toast({ title: '已複製到剪貼簿' });
  }, [babyCornPrice, babyCornLines, babyCornSubtotal, cornPrice, cornLines, cornSubtotal, companyLines, companySubtotal, miscLines, miscSubtotal, grandTotal, toast]);

  const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">計算機</h2>
        <Button variant="outline" size="sm" onClick={copyText}>
          <Copy className="h-4 w-4 mr-1" /> 複製今日明細
        </Button>
      </div>

      {/* 玉米筍 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">🌽 玉米筍</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium whitespace-nowrap">今日單價 (每公斤)</span>
            <Input
              type="number"
              min={0}
              className="w-28"
              value={babyCornPrice || ''}
              onChange={e => setBabyCornPrice(parseNum(e.target.value))}
              placeholder="0"
            />
          </div>
          <p className="text-xs text-muted-foreground">台斤計算 = 單價(公斤) × 台斤數量 × 0.6</p>

          <div className="space-y-2">
            {babyCornLines.map(line => {
              const lt = calcLineTotal(babyCornPrice, line.qty, line.unit);
              return (
                <div key={line.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={line.qty || ''}
                    onChange={e => updateLine(setBabyCornLines, line.id, { qty: parseNum(e.target.value) })}
                    onKeyDown={makeKeyHandler(setBabyCornLines, line.id, () => ({ id: nextId(), qty: 0, unit: '公斤' }), { qty: 0 })}
                    placeholder="數量"
                  />
                  <Select
                    value={line.unit}
                    onValueChange={v => updateLine(setBabyCornLines, line.id, { unit: v as Line['unit'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="公斤">公斤</SelectItem>
                      <SelectItem value="台斤">台斤</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium w-28 text-right">{fmt(lt)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeLine(setBabyCornLines, line.id)}
                    disabled={babyCornLines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setBabyCornLines(p => [...p, { id: nextId(), qty: 0, unit: '公斤' }])}
          >
            <Plus className="h-4 w-4 mr-1" /> 新增一列
          </Button>

          <div className="text-right font-semibold">小計：{fmt(babyCornSubtotal)}</div>
        </CardContent>
      </Card>

      {/* 玉米 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">🌽 玉米</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium whitespace-nowrap">今日單價 (每公斤)</span>
            <Input
              type="number"
              min={0}
              className="w-28"
              value={cornPrice || ''}
              onChange={e => setCornPrice(parseNum(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            {cornLines.map(line => {
              const lt = calcLineTotal(cornPrice, line.qty, line.unit);
              return (
                <div key={line.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={line.qty || ''}
                    onChange={e => updateLine(setCornLines, line.id, { qty: parseNum(e.target.value) })}
                    onKeyDown={makeKeyHandler(setCornLines, line.id, () => ({ id: nextId(), qty: 0, unit: '公斤' }), { qty: 0 })}
                    placeholder="數量"
                  />
                  <Select
                    value={line.unit}
                    onValueChange={v => updateLine(setCornLines, line.id, { unit: v as Line['unit'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="公斤">公斤</SelectItem>
                      <SelectItem value="台斤">台斤</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium w-28 text-right">{fmt(lt)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeLine(setCornLines, line.id)}
                    disabled={cornLines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCornLines(p => [...p, { id: nextId(), qty: 0, unit: '公斤' }])}
          >
            <Plus className="h-4 w-4 mr-1" /> 新增一列
          </Button>

          <div className="text-right font-semibold">小計：{fmt(cornSubtotal)}</div>
        </CardContent>
      </Card>

      {/* 公司玉米 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">🏢 公司傳票</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">公司傳票含稅：單價 × 公斤數 × 1.02（固定公斤不需換算）</p>

          <div className="space-y-2">
            {companyLines.map(line => {
              const lt = line.pricePerKg * line.qty * 1.02;
              return (
                <div key={line.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={line.pricePerKg || ''}
                    onChange={e => updateLine(setCompanyLines, line.id, { pricePerKg: parseNum(e.target.value) })}
                    placeholder="單價"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={line.qty || ''}
                    onChange={e => updateLine(setCompanyLines, line.id, { qty: parseNum(e.target.value) })}
                    onKeyDown={makeKeyHandler(setCompanyLines, line.id, () => ({ id: nextId(), pricePerKg: 0, qty: 0 }), { pricePerKg: 0, qty: 0 })}
                    placeholder="公斤"
                  />
                  <span className="text-xs text-muted-foreground">公斤</span>
                  <span className="text-sm font-medium w-28 text-right">{fmt(lt)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeLine(setCompanyLines, line.id)}
                    disabled={companyLines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompanyLines(p => [...p, { id: nextId(), pricePerKg: 0, qty: 0 }])}
          >
            <Plus className="h-4 w-4 mr-1" /> 新增一列
          </Button>

          <div className="text-right font-semibold">小計：{fmt(companySubtotal)}</div>
        </CardContent>
      </Card>

      {/* 雜項 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">📝 雜項</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">可輸入負數，代表付出去的錢（會從總計扣除）。Enter 新增一列，Ctrl/Shift+Delete 清空當列。</p>

          <div className="space-y-2">
            {miscLines.map(line => {
              const lt = line.amount * line.qty;
              const newMisc = (): MiscLine => ({ id: nextId(), name: '', amount: 0, qty: 1 });
              const keyHandler = makeKeyHandler<MiscLine>(setMiscLines, line.id, newMisc, { name: '', amount: 0, qty: 1 });
              return (
                <div key={line.id} className="flex items-center gap-2">
                  <Input
                    type="text"
                    className="w-28"
                    value={line.name}
                    onChange={e => updateLine(setMiscLines, line.id, { name: e.target.value })}
                    onKeyDown={keyHandler}
                    placeholder="項目"
                  />
                  <Input
                    type="number"
                    className="w-28"
                    value={line.amount === 0 ? '' : line.amount}
                    onChange={e => updateLine(setMiscLines, line.id, { amount: parseSignedNum(e.target.value) })}
                    onKeyDown={keyHandler}
                    placeholder="金額"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <Input
                    type="number"
                    className="w-20"
                    value={line.qty || ''}
                    onChange={e => updateLine(setMiscLines, line.id, { qty: parseSignedNum(e.target.value) })}
                    onKeyDown={keyHandler}
                    placeholder="數量"
                  />
                  <span className={`text-sm font-medium w-28 text-right ${lt < 0 ? 'text-destructive' : ''}`}>
                    {fmt(lt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeLine(setMiscLines, line.id)}
                    disabled={miscLines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMiscLines(p => [...p, { id: nextId(), name: '', amount: 0, qty: 1 }])}
          >
            <Plus className="h-4 w-4 mr-1" /> 新增一列
          </Button>

          <div className={`text-right font-semibold ${miscSubtotal < 0 ? 'text-destructive' : ''}`}>
            小計：{fmt(miscSubtotal)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary">
        <CardContent className="py-4">
          <div className="text-center text-xl font-bold">
            總計：{fmt(grandTotal)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
