import { Clock, RefreshCw } from 'lucide-react';

interface UpdateBannerProps {
  lastUpdated: Date | null;
  isAdminMode: boolean;
}

export function UpdateBanner({ lastUpdated, isAdminMode }: UpdateBannerProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    if (isToday) {
      return `今日 ${timeStr}`;
    }
    
    const dateStr = date.toLocaleDateString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
    });
    
    return `${dateStr} ${timeStr}`;
  };

  return (
    <div className="bg-secondary py-3">
      <div className="container">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-secondary-foreground">
            <Clock className="h-4 w-4" />
            <span>最後更新：{lastUpdated ? formatDate(lastUpdated) : '尚無資料'}</span>
          </div>
          {isAdminMode && (
            <div className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
              <RefreshCw className="h-3 w-3" />
              管理模式
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
