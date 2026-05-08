import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Vegetable, VegetableStatus, VegetablePrice } from '@/types/vegetable';

export function useRetailVegetables() {
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVegetables = useCallback(async () => {
    try {
      const { data: vegsData, error: vegsError } = await supabase
        .from('retail_vegetables')
        .select('*')
        .order('sort_order', { ascending: true });

      if (vegsError) throw vegsError;

      const { data: pricesData, error: pricesError } = await supabase
        .from('retail_vegetable_prices')
        .select('*')
        .order('sort_order', { ascending: true });

      if (pricesError) throw pricesError;

      const pricesByVegId = (pricesData || []).reduce((acc: Record<string, VegetablePrice[]>, price: any) => {
        const vegId = price.vegetable_id;
        if (!acc[vegId]) acc[vegId] = [];
        acc[vegId].push(price as VegetablePrice);
        return acc;
      }, {});

      const vegs = (vegsData || []).map(v => ({
        ...v,
        prices: pricesByVegId[v.id] || [],
      })) as Vegetable[];

      setVegetables(vegs);
      
      if (vegs.length > 0) {
        const latestDate = vegs.reduce((latest, v) => {
          const vDate = new Date(v.updated_at);
          return vDate > latest ? vDate : latest;
        }, new Date(vegs[0].updated_at));
        setLastUpdated(latestDate);
      }
    } catch (error) {
      console.error('Error fetching retail vegetables:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVegetables();
  }, [fetchVegetables]);

  const getAdminCredentials = () => {
    const credentials = sessionStorage.getItem('adminCredentials');
    if (!credentials) return null;
    try {
      return JSON.parse(credentials);
    } catch {
      return null;
    }
  };

  const invokeRetailAdmin = async (body: Record<string, any>) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('retail-vegetables-admin', {
      body: { ...body, username: credentials.username, password: credentials.password },
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  };

  const addVegetable = useCallback(async (vegetable: Omit<Vegetable, 'id' | 'sort_order' | 'updated_at' | 'created_at'>) => {
    await invokeRetailAdmin({ action: 'add', vegetable });
    await fetchVegetables();
  }, [fetchVegetables]);

  const updateVegetable = useCallback(async (id: string, updates: Partial<Vegetable>) => {
    setVegetables(prev => prev.map(v =>
      v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
    ));
    setLastUpdated(new Date());

    try {
      await invokeRetailAdmin({ action: 'update', id, updates });
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [fetchVegetables]);

  const deleteVegetable = useCallback(async (id: string) => {
    await invokeRetailAdmin({ action: 'delete', id });
    await fetchVegetables();
  }, [fetchVegetables]);

  const addPrice = useCallback(async (vegetableId: string, unit: string, price: number) => {
    await invokeRetailAdmin({ action: 'add_price', vegetable: { vegetable_id: vegetableId, unit, price } });
    await fetchVegetables();
  }, [fetchVegetables]);

  const updatePrice = useCallback(async (priceId: string, vegetableId: string, unit: string, price: number) => {
    setVegetables(prev => prev.map(v => {
      if (v.id === vegetableId) {
        return { ...v, updated_at: new Date().toISOString(), prices: v.prices?.map(p => p.id === priceId ? { ...p, unit, price } : p) };
      }
      return v;
    }));
    setLastUpdated(new Date());

    try {
      await invokeRetailAdmin({ action: 'update_price', vegetable: { price_id: priceId, vegetable_id: vegetableId, unit, price } });
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [fetchVegetables]);

  const deletePrice = useCallback(async (priceId: string, vegetableId: string) => {
    await invokeRetailAdmin({ action: 'delete_price', vegetable: { price_id: priceId, vegetable_id: vegetableId } });
    await fetchVegetables();
  }, [fetchVegetables]);

  const toggleStatus = useCallback(async (id: string) => {
    const vegetable = vegetables.find(v => v.id === id);
    if (!vegetable) return;
    const newStatus: VegetableStatus = vegetable.status === 'in_stock' ? 'out_of_stock' : 'in_stock';
    await updateVegetable(id, { status: newStatus });
  }, [vegetables, updateVegetable]);

  const toggleVisibility = useCallback(async (id: string) => {
    const vegetable = vegetables.find(v => v.id === id);
    if (!vegetable) return;
    const newStatus: VegetableStatus = vegetable.status === 'hidden' ? 'in_stock' : 'hidden';
    await updateVegetable(id, { status: newStatus });
  }, [vegetables, updateVegetable]);

  const moveUp = useCallback(async (id: string) => {
    const index = vegetables.findIndex(v => v.id === id);
    if (index <= 0) return;
    await Promise.all([
      updateVegetable(vegetables[index].id, { sort_order: vegetables[index - 1].sort_order }),
      updateVegetable(vegetables[index - 1].id, { sort_order: vegetables[index].sort_order }),
    ]);
  }, [vegetables, updateVegetable]);

  const moveDown = useCallback(async (id: string) => {
    const index = vegetables.findIndex(v => v.id === id);
    if (index === -1 || index >= vegetables.length - 1) return;
    await Promise.all([
      updateVegetable(vegetables[index].id, { sort_order: vegetables[index + 1].sort_order }),
      updateVegetable(vegetables[index + 1].id, { sort_order: vegetables[index].sort_order }),
    ]);
  }, [vegetables, updateVegetable]);

  const reorderVegetables = useCallback(async (activeId: string, overId: string) => {
    const oldIndex = vegetables.findIndex(v => v.id === activeId);
    const newIndex = vegetables.findIndex(v => v.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const newVegetables = [...vegetables];
    const [movedItem] = newVegetables.splice(oldIndex, 1);
    newVegetables.splice(newIndex, 0, movedItem);
    const updatedVegetables = newVegetables.map((v, idx) => ({ ...v, sort_order: idx }));
    setVegetables(updatedVegetables);

    try {
      await invokeRetailAdmin({
        action: 'reorder',
        orders: updatedVegetables.map(v => ({ id: v.id, sort_order: v.sort_order })),
      });
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [vegetables, fetchVegetables]);

  const bulkUpdateVegetables = useCallback(async (items: { id: string; prices: { id: string; price: number; unit: string }[] }[]) => {
    const now = new Date().toISOString();
    setVegetables(prev => prev.map(v => {
      const item = items.find(i => i.id === v.id);
      if (item) {
        return { ...v, updated_at: now, prices: v.prices?.map(p => {
          const up = item.prices.find(ip => ip.id === p.id);
          return up ? { ...p, price: up.price, unit: up.unit } : p;
        }) };
      }
      return v;
    }));
    setLastUpdated(new Date());

    try {
      await invokeRetailAdmin({ action: 'bulk_update', vegetable: { items } });
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [fetchVegetables]);

  const visibleVegetables = vegetables
    .filter(v => v.status !== 'hidden')
    .sort((a, b) => {
      if (a.status === 'out_of_stock' && b.status !== 'out_of_stock') return 1;
      if (a.status !== 'out_of_stock' && b.status === 'out_of_stock') return -1;
      return a.sort_order - b.sort_order;
    });

  return {
    vegetables,
    visibleVegetables,
    lastUpdated,
    isLoading,
    addVegetable,
    updateVegetable,
    deleteVegetable,
    addPrice,
    updatePrice,
    deletePrice,
    toggleStatus,
    toggleVisibility,
    moveUp,
    moveDown,
    reorderVegetables,
    bulkUpdateVegetables,
    refetch: fetchVegetables,
  };
}
