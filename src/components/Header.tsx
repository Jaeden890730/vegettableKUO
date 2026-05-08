import { Leaf, Settings, LogOut, Sun, Moon, ShoppingCart, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';

interface HeaderProps {
  isAdminMode: boolean;
  onLogout: () => void;
}

export function Header({ isAdminMode, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Prefetch route chunks to make navigation feel instant
  const prefetchCustomerAuth = () => import('@/pages/CustomerAuth');
  const prefetchAdminAuth = () => import('@/pages/Auth');
  const prefetchAdminPanel = () => import('@/pages/AdminPanel');

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-primary via-primary to-emerald-600 text-primary-foreground shadow-lg backdrop-blur-sm">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      <div className="container relative py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 shadow-inner backdrop-blur-sm ring-1 ring-white/20 transition-transform hover:scale-105">
              <Leaf className="h-6 w-6 drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight drop-shadow-sm">旭海 餐飲蔬菜供應</h1>
              <p className="text-xs font-medium text-primary-foreground/70 tracking-wide">每日更新｜價格透明</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-primary-foreground ring-1 ring-white/20 transition-all hover:bg-white/25 hover:shadow-md active:scale-95"
              aria-label="切換深色模式"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Customer order button */}
            <button
              onMouseEnter={prefetchCustomerAuth}
              onFocus={prefetchCustomerAuth}
              onClick={() => navigate('/customer-auth')}
              className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-white/20 transition-all hover:bg-white/25 hover:shadow-md active:scale-95"
              title="客戶下單"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">下單</span>
            </button>

            {isAdminMode ? (
              <>
                <button
                  onMouseEnter={prefetchAdminPanel}
                  onFocus={prefetchAdminPanel}
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-white/20 transition-all hover:bg-white/25 hover:shadow-md active:scale-95"
                  title="管理後台"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">後台</span>
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-white/20 transition-all hover:bg-white/25 hover:shadow-md active:scale-95"
                  title="登出管理模式"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">登出</span>
                </button>
              </>
            ) : (
              <button
                onMouseEnter={prefetchAdminAuth}
                onFocus={prefetchAdminAuth}
                onClick={() => navigate('/auth')}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-primary-foreground ring-1 ring-white/20 transition-all hover:bg-white/25 hover:shadow-md active:scale-95"
                aria-label="開啟管理模式"
              >
                <Settings className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
