import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 檢查 sessionStorage 中的登入狀態
    const adminStatus = sessionStorage.getItem('isAdmin');
    setIsAuthenticated(adminStatus === 'true');
    setIsLoading(false);
  }, []);

  const signOut = () => {
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminCredentials');
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    isLoading,
    signOut,
  };
}
