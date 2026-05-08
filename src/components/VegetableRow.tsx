import { CheckCircle2, XCircle, Package, ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Edit2, Tag } from 'lucide-react';
import { Vegetable } from '@/types/vegetable';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface VegetableRowProps {
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

export function VegetableRow({
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
}: VegetableRowProps) {
  const isOutOfStock = vegetable.status === 'out_of_stock';
  const isHidden = vegetable.status === 'hidden';
  const isActive = !isOutOfStock && !isHidden;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-card transition-all duration-300 ${
        isActive 
          ? 'border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5' 
          : isHidden 
            ? 'border-border/20 bg-muted/30 opacity-40' 
            : 'border-border/30 opacity-60'
      }`}
    >
      {/* Subtle gradient overlay for depth */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/50 via-transparent to-transparent pointer-events-none" />
      )}
      
      {/* Main content */}
      <div className="relative flex flex-col gap-1 p-2">
        {/* Top row: status + name */}
        <div className="flex items-start gap-1.5">
          {/* Status indicator */}
          <div className={`relative mt-1 h-2 w-2 shrink-0 rounded-full ${
            isActive 
              ? 'bg-success' 
              : 'bg-unavailable'
          }`} />
          
          {/* Name */}
          <div className="flex-1 min-w-0">
            <span className={`font-semibold text-sm leading-tight ${
              isActive ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {vegetable.name}
            </span>
            {vegetable.is_wholesale && isActive && (
              <span className="ml-1 text-[9px] text-accent-foreground">批</span>
            )}
            {isHidden && isAdminMode && (
              <span className="ml-1 text-[9px] text-muted-foreground">(隱藏)</span>
            )}
            {isAdminMode && vegetable.tag && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0 h-4">
                {vegetable.tag}
              </Badge>
            )}
          </div>
        </div>

        {/* Price section - compact */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {isOutOfStock ? (
            <span className="rounded bg-unavailable/15 px-1.5 py-0.5 text-xs font-bold text-unavailable-foreground">
              缺貨
            </span>
          ) : (
            <>
              {vegetable.prices && vegetable.prices.length > 0 ? (
                vegetable.prices.map((p, idx) => (
                  <span 
                    key={p.id} 
                    className={`whitespace-nowrap ${
                      idx === 0 
                        ? 'text-base font-bold text-price' 
                        : 'text-sm font-medium text-price/70'
                    }`}
                  >
                    ${p.price}<span className="text-[10px] font-normal text-muted-foreground">/{p.unit}</span>
                  </span>
                ))
              ) : (
                <span className="text-base font-bold text-price">
                  ${vegetable.price}<span className="text-[10px] font-normal text-muted-foreground">/{vegetable.unit}</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Update time - very subtle */}
        <div className="text-[9px] text-muted-foreground/40 tabular-nums">
          {format(new Date(vegetable.updated_at), 'M/d HH:mm', { locale: zhTW })}
        </div>
      </div>

      {/* Admin controls */}
      {isAdminMode && (
        <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-2 py-1.5 rounded-b-lg">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onMoveUp(vegetable.id)}
              disabled={isFirst}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 transition-colors"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => onMoveDown(vegetable.id)}
              disabled={isLast}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onToggleStatus(vegetable.id)}
              className={`p-1.5 rounded transition-colors ${
                isOutOfStock 
                  ? 'text-success hover:bg-success/10' 
                  : 'text-unavailable hover:bg-unavailable/10'
              }`}
              title={isOutOfStock ? '設為供貨中' : '設為缺貨'}
            >
              {isOutOfStock ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onToggleVisibility(vegetable.id)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title={isHidden ? '顯示' : '隱藏'}
            >
              {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onEdit(vegetable)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(vegetable.id)}
              className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
