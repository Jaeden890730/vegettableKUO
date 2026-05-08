import { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LayoutDashboard, ShoppingCart, ClipboardList, FileText, CreditCard, Users, ArrowLeft, Menu, X, History, BarChart3, Calculator, TrendingUp, Settings, CalendarOff, Equal, Salad, Tags, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Admin sub-pages (lazy-loaded for faster initial load)
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard'));
const AdminOrders = lazy(() => import('@/components/admin/AdminOrders'));
const AdminPendingSettlement = lazy(() => import('@/components/admin/AdminPendingSettlement'));
const AdminSettlementCenter = lazy(() => import('@/components/admin/AdminSettlementCenter'));
const AdminOrderHistory = lazy(() => import('@/components/admin/AdminOrderHistory'));
const AdminSettlements = lazy(() => import('@/components/admin/AdminSettlements'));
const AdminPayments = lazy(() => import('@/components/admin/AdminPayments'));
const AdminCustomers = lazy(() => import('@/components/admin/AdminCustomers'));
const AdminDailyStats = lazy(() => import('@/components/admin/AdminDailyStats'));
const AdminAccounting = lazy(() => import('@/components/admin/AdminAccounting'));
const AdminAnalytics = lazy(() => import('@/components/admin/AdminAnalytics'));
const AdminSettings = lazy(() => import('@/components/admin/AdminSettings'));
const AdminHolidays = lazy(() => import('@/components/admin/AdminHolidays'));
const AdminCalculator = lazy(() => import('@/components/admin/AdminCalculator'));
const AdminPriceList = lazy(() => import('@/components/admin/AdminPriceList'));
const AdminTagOrders = lazy(() => import('@/components/admin/AdminTagOrders'));
const AdminSupplierOrders = lazy(() => import('@/components/admin/AdminSupplierOrders'));
const AdminCreateOrder = lazy(() => import('@/components/admin/AdminCreateOrder'));


const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: '儀表板', exact: true },
  { path: '/admin/create-order', icon: PlusCircle, label: '幫客戶下單' },
  { path: '/admin/daily-stats', icon: BarChart3, label: '當日統計' },
  { path: '/admin/orders', icon: ShoppingCart, label: '訂單管理', exact: true },
  { path: '/admin/settlement-center', icon: ClipboardList, label: '待結 / 結帳' },
  { path: '/admin/payments', icon: CreditCard, label: '收款管理' },
  { path: '/admin/order-history', icon: History, label: '歷史訂單' },
  { path: '/admin/customers', icon: Users, label: '客戶管理' },
  { path: '/admin/analytics', icon: TrendingUp, label: '分析' },
  { path: '/admin/accounting', icon: Calculator, label: '記帳' },
  { path: '/admin/calculator', icon: Equal, label: '計算機' },
  { path: '/admin/price-list', icon: Salad, label: '菜價展示' },
  { path: '/admin/tag-orders', icon: Tags, label: '標籤排序' },
  { path: '/admin/supplier-orders', icon: Tags, label: '供貨商排序' },
  { path: '/admin/holidays', icon: CalendarOff, label: '休假日' },
  { path: '/admin/settings', icon: Settings, label: '設定' },
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold">管理後台</h1>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-56 border-r border-border bg-card min-h-[calc(100vh-60px)]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact 
                ? location.pathname === item.path 
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-[60px] z-40 bg-background">
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = item.exact 
                  ? location.pathname === item.path 
                  : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/create-order" element={<AdminCreateOrder />} />
              <Route path="/daily-stats" element={<AdminDailyStats />} />
              <Route path="/orders" element={<AdminOrders />} />
              <Route path="/settlement-center" element={<AdminSettlementCenter />} />
              <Route path="/pending-settlement" element={<AdminPendingSettlement />} />
              <Route path="/order-history" element={<AdminOrderHistory />} />
              <Route path="/settlements" element={<AdminSettlements />} />
              <Route path="/payments" element={<AdminPayments />} />
              <Route path="/customers" element={<AdminCustomers />} />
              <Route path="/analytics" element={<AdminAnalytics />} />
              <Route path="/accounting" element={<AdminAccounting />} />
              <Route path="/calculator" element={<AdminCalculator />} />
              <Route path="/price-list" element={<AdminPriceList />} />
              <Route path="/tag-orders" element={<AdminTagOrders />} />
              <Route path="/supplier-orders" element={<AdminSupplierOrders />} />
              <Route path="/holidays" element={<AdminHolidays />} />
              <Route path="/settings" element={<AdminSettings />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
