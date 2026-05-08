import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, User, Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function Auth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-login', {
        body: { username, password }
      });

      if (error) {
        toast.error('登入失敗');
        return;
      }

      if (data.success) {
        // 設置 Supabase session（讓 RLS 能正確識別 admin）
        if (data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('adminCredentials', JSON.stringify({ username, password }));
        toast.success('登入成功');
        navigate('/admin', { replace: true });
      } else {
        toast.error(data.error || '帳號或密碼錯誤');
      }
    } catch {
      toast.error('登入失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首頁
        </button>

        <div className="mx-auto max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-4">
              <span className="text-2xl font-bold text-primary-foreground">菜</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              管理員登入
            </h1>
            <p className="mt-2 text-muted-foreground">
              請輸入您的帳號密碼
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                帳號
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="請輸入帳號"
                  className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              登入
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
