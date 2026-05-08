import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import FloatingCalculator from "@/components/FloatingCalculator";
import FloatingNotes from "@/components/FloatingNotes";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const CustomerAuth = lazy(() => import("./pages/CustomerAuth"));
const CustomerPanel = lazy(() => import("./pages/CustomerPanel"));
const CustomerOrderHistory = lazy(() => import("./pages/CustomerOrderHistory"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/customer-auth" element={<CustomerAuth />} />
              <Route path="/order" element={<CustomerPanel />} />
              <Route path="/customer-order" element={<CustomerPanel />} />
              <Route path="/order-history" element={<CustomerOrderHistory />} />
              <Route path="/admin/*" element={<AdminPanel />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <FloatingCalculator />
          <FloatingNotes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
