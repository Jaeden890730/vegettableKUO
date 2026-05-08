import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TagOrder {
  id: string;
  tag_name: string;
  sort_order: number;
}

export function useTagOrders() {
  const [tagOrders, setTagOrders] = useState<TagOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTagOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tag_orders')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTagOrders((data || []) as TagOrder[]);
    } catch (error) {
      console.error('Error fetching tag orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTagOrders();
  }, [fetchTagOrders]);

  const getAdminCredentials = () => {
    const credentials = sessionStorage.getItem('adminCredentials');
    if (!credentials) return null;
    try {
      return JSON.parse(credentials);
    } catch {
      return null;
    }
  };

  const saveTagOrders = useCallback(async (tags: { tag_name: string; sort_order: number }[]) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('vegetables-admin', {
      body: {
        action: 'save_tag_orders',
        username: credentials.username,
        password: credentials.password,
        vegetable: { tags },
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    await fetchTagOrders();
  }, [fetchTagOrders]);

  return {
    tagOrders,
    isLoading,
    saveTagOrders,
    refetch: fetchTagOrders,
  };
}
