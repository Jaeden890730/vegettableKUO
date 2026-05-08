import { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ShoppingCart, ClipboardList, FileText, Menu, X } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { cn } from '@/lib/utils';

const CustomerOrderForm = lazy(() => import('@/components/customer/CustomerOrderForm'));
const CustomerOrderList = lazy(() => import('@/components/customer/CustomerOrderList'));
const CustomerSettlementList = lazy(() => import('@/components/customer/CustomerSettlementList'));


type Tab = 'order' | 'history' | 'settlements';

export default function CustomerPanel() {
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer, customerId, customerName, isLoading: authLoading, signOut } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<Tab>('order');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isCustomer)) {
      navigate('/customer-auth');
    }
  }, [isAuthenticated, isCustomer, authLoading, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    { id: 'order' as Tab, icon: ShoppingCart, label: '下單' },
    { id: 'history' as Tab, icon: ClipboardList, label: '訂單' },
    { id: 'settlements' as Tab, icon: FileText, label: '結帳單' },
  ];

  // Show loading only briefly, or skip if we have customer data
  if (authLoading && !customerId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden text-primary-foreground/80 hover:text-primary-foreground"
              >
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold">客戶專區</h1>
                {customerName && (
                  <span className="text-sm text-primary-foreground/80">{customerName}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-48 border-r border-border bg-card min-h-[calc(100vh-60px)]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile Sidebar */}
        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 top-[60px] z-40 bg-background">
            <nav className="p-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ))}
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
            {activeTab === 'order' && <CustomerOrderForm customerId={customerId} customerName={customerName} />}
            {activeTab === 'history' && <CustomerOrderList customerId={customerId} />}
            {activeTab === 'settlements' && <CustomerSettlementList customerId={customerId} />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
