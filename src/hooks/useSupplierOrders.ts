import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierOrder {
  id: string;
  supplier_name: string;
  sort_order: number;
}

export function useSupplierOrders() {
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSupplierOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_orders')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSupplierOrders((data || []) as SupplierOrder[]);
    } catch (error) {
      console.error('Error fetching supplier orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSupplierOrders();
  }, [fetchSupplierOrders]);

  const getAdminCredentials = () => {
    const credentials = sessionStorage.getItem('adminCredentials');
    if (!credentials) return null;
    try {
      return JSON.parse(credentials);
    } catch {
      return null;
    }
  };

  const saveSupplierOrders = useCallback(
    async (suppliers: { supplier_name: string; sort_order: number }[]) => {
      const credentials = getAdminCredentials();
      if (!credentials) throw new Error('未登入');

      const { data, error } = await supabase.functions.invoke('vegetables-admin', {
        body: {
          action: 'save_supplier_orders',
          username: credentials.username,
          password: credentials.password,
          vegetable: { suppliers },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      await fetchSupplierOrders();
    },
    [fetchSupplierOrders]
  );

  return {
    supplierOrders,
    isLoading,
    saveSupplierOrders,
    refetch: fetchSupplierOrders,
  };
}
