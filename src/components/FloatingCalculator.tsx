import { useState, useCallback } from 'react';
import { Calculator, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

const FloatingCalculator = () => {
  const { isAdmin } = useSupabaseAuth();
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const calc = useCallback((a: number, b: number, o: string) => {
    switch (o) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  }, []);

  if (!isAdmin) return null;

  const input = (d: string) => {
    if (fresh) {
      setDisplay(d === '.' ? '0.' : d);
      setFresh(false);
    } else {
      if (d === '.' && display.includes('.')) return;
      setDisplay(display === '0' && d !== '.' ? d : display + d);
    }
  };

  const doOp = (nextOp: string) => {
    const cur = parseFloat(display);
    if (prev !== null && op && !fresh) {
      const result = calc(prev, cur, op);
      setPrev(result);
      setDisplay(String(Math.round(result * 1e8) / 1e8));
    } else {
      setPrev(cur);
    }
    setOp(nextOp);
    setFresh(true);
  };

  const equals = () => {
    if (prev === null || !op) return;
    const cur = parseFloat(display);
    const result = calc(prev, cur, op);
    setDisplay(String(Math.round(result * 1e8) / 1e8));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const clear = () => {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const tax = () => {
    const cur = parseFloat(display);
    const result = Math.round(cur * 1.02 * 1e8) / 1e8;
    setDisplay(String(result));
    setFresh(true);
  };

  const percent = () => {
    const cur = parseFloat(display);
    setDisplay(String(cur / 100));
    setFresh(true);
  };

  // 公斤單價 → 台斤單價 (台斤價 = 公斤價 × 0.6)
  const kgToTaiJin = () => {
    const cur = parseFloat(display);
    const result = Math.round(cur * 0.6 * 1e8) / 1e8;
    setDisplay(String(result));
    setFresh(true);
  };

  // 台斤單價 → 公斤單價 (公斤價 = 台斤價 ÷ 0.6)
  const taiJinToKg = () => {
    const cur = parseFloat(display);
    const result = Math.round(cur / 0.6 * 1e8) / 1e8;
    setDisplay(String(result));
    setFresh(true);
  };

  const btnClass = "h-12 w-full text-lg font-semibold rounded-lg";

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-[9999] w-72 bg-background border border-border rounded-2xl shadow-2xl p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-foreground">計算機</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="bg-muted rounded-lg px-3 py-3 text-right text-2xl font-mono font-bold text-foreground min-h-[48px] break-all leading-tight">
            {display}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <Button variant="default" className={`${btnClass} col-span-2 bg-blue-500 hover:bg-blue-600 text-white text-xs`} onClick={kgToTaiJin}>公斤→斤</Button>
            <Button variant="default" className={`${btnClass} col-span-2 bg-blue-500 hover:bg-blue-600 text-white text-xs`} onClick={taiJinToKg}>斤→公斤</Button>

            <Button variant="secondary" className={btnClass} onClick={clear}>C</Button>
            <Button variant="secondary" className={btnClass} onClick={percent}>%</Button>
            <Button variant="default" className={`${btnClass} bg-amber-500 hover:bg-amber-600 text-white text-xs`} onClick={tax}>稅</Button>
            <Button variant="secondary" className={btnClass} onClick={() => doOp('÷')}>÷</Button>

            {['7','8','9'].map(d => (
              <Button key={d} variant="outline" className={btnClass} onClick={() => input(d)}>{d}</Button>
            ))}
            <Button variant="secondary" className={btnClass} onClick={() => doOp('×')}>×</Button>

            {['4','5','6'].map(d => (
              <Button key={d} variant="outline" className={btnClass} onClick={() => input(d)}>{d}</Button>
            ))}
            <Button variant="secondary" className={btnClass} onClick={() => doOp('-')}>−</Button>

            {['1','2','3'].map(d => (
              <Button key={d} variant="outline" className={btnClass} onClick={() => input(d)}>{d}</Button>
            ))}
            <Button variant="secondary" className={btnClass} onClick={() => doOp('+')}>+</Button>

            <Button variant="outline" className={`${btnClass} col-span-2`} onClick={() => input('0')}>0</Button>
            <Button variant="outline" className={btnClass} onClick={() => input('.')}>.</Button>
            <Button variant="default" className={btnClass} onClick={equals}>=</Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-[9999] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform"
      >
        <Calculator className="h-6 w-6" />
      </button>
    </>
  );
};

export default FloatingCalculator;
