import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Vegetable, VegetableStatus, VegetablePrice } from '@/types/vegetable';
import { TagOrder } from '@/hooks/useTagOrders';

const CACHE_KEY = 'vegetables_cache';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes for localStorage staleness

interface CachedData {
  vegetables: Vegetable[];
  tagOrders: TagOrder[];
  lastUpdated: string | null;
  timestamp: number;
}

function loadCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedData;
    // Accept cache up to CACHE_MAX_AGE
    if (Date.now() - data.timestamp > CACHE_MAX_AGE) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(vegetables: Vegetable[], tagOrders: TagOrder[], lastUpdated: string | null) {
  try {
    const data: CachedData = { vegetables, tagOrders, lastUpdated, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded, ignore */ }
}

function parseApiResponse(data: any): { vegs: Vegetable[]; tagOrders: TagOrder[]; lastUpdated: Date | null } {
  const vegsData = data.vegetables || [];
  const pricesData = data.prices || [];
  const tagOrders = (data.tag_orders || []) as TagOrder[];

  const pricesByVegId = (pricesData).reduce((acc: Record<string, VegetablePrice[]>, price: any) => {
    const vegId = price.vegetable_id;
    if (!acc[vegId]) acc[vegId] = [];
    acc[vegId].push(price as VegetablePrice);
    return acc;
  }, {} as Record<string, VegetablePrice[]>);

  const vegs = (vegsData).map((v: any) => ({
    ...v,
    prices: pricesByVegId[v.id] || [],
  })) as Vegetable[];

  let lastUpdated: Date | null = null;
  if (vegs.length > 0) {
    lastUpdated = vegs.reduce((latest, v) => {
      const vDate = new Date(v.updated_at);
      return vDate > latest ? vDate : latest;
    }, new Date(vegs[0].updated_at));
  }

  return { vegs, tagOrders, lastUpdated };
}

export function useVegetables(isAdmin: boolean = false) {
  // Try to load from cache for instant render
  const cached = useRef(loadCache());
  const [vegetables, setVegetables] = useState<Vegetable[]>(cached.current?.vegetables || []);
  const [tagOrders, setTagOrders] = useState<TagOrder[]>(cached.current?.tagOrders || []);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    cached.current?.lastUpdated ? new Date(cached.current.lastUpdated) : null
  );
  const [isLoading, setIsLoading] = useState(!cached.current);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchVegetables = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-vegetables');
      if (error) throw error;

      const { vegs, tagOrders: tOrders, lastUpdated: lu } = parseApiResponse(data);

      setVegetables(vegs);
      setTagOrders(tOrders);
      setLastUpdated(lu);

      // Save to localStorage for next visit
      saveCache(vegs, tOrders, lu?.toISOString() || null);
    } catch (error) {
      console.error('Error fetching vegetables:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (cached.current) {
      // We have cache → show it immediately, fetch in background
      setIsRefreshing(true);
    }
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

  const addVegetable = useCallback(async (vegetable: Omit<Vegetable, 'id' | 'sort_order' | 'updated_at' | 'created_at'>) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('vegetables-admin', {
      body: {
        action: 'add',
        username: credentials.username,
        password: credentials.password,
        vegetable,
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    await fetchVegetables();
  }, [fetchVegetables]);

  const updateVegetable = useCallback(async (id: string, updates: Partial<Vegetable>) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    // Optimistic update
    setVegetables(prev => prev.map(v => 
      v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
    ));
    setLastUpdated(new Date());

    try {
      const { data, error } = await supabase.functions.invoke('vegetables-admin', {
        body: {
          action: 'update',
          username: credentials.username,
          password: credentials.password,
          id,
          updates,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [fetchVegetables]);

  const deleteVegetable = useCallback(async (id: string) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('vegetables-admin', {
      body: {
        action: 'delete',
        username: credentials.username,
        password: credentials.password,
        id,
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    await fetchVegetables();
  }, [fetchVegetables]);

  const addPrice = useCallback(async (vegetableId: string, unit: string, price: number) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('vegetables-admin', {
      body: {
        action: 'add_price',
        username: credentials.username,
        password: credentials.password,
        vegetable: { vegetable_id: vegetableId, unit, price },
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    await fetchVegetables();
  }, [fetchVegetables]);

  const updatePrice = useCallback(async (priceId: string, vegetableId: string, unit: string, price: number) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    // Optimistic update
    setVegetables(prev => prev.map(v => {
      if (v.id === vegetableId) {
        return {
          ...v,
          updated_at: new Date().toISOString(),
          prices: v.prices.map(p => 
            p.id === priceId ? { ...p, unit, price } : p
          )
        };
      }
      return v;
    }));
    setLastUpdated(new Date());

    try {
      const { data, error } = await supabase.functions.invoke('vegetables-admin', {
        body: {
          action: 'update_price',
          username: credentials.username,
          password: credentials.password,
          vegetable: { price_id: priceId, vegetable_id: vegetableId, unit, price },
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [fetchVegetables]);

  const deletePrice = useCallback(async (priceId: string, vegetableId: string) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('vegetables-admin', {
      body: {
        action: 'delete_price',
        username: credentials.username,
        password: credentials.password,
        vegetable: { price_id: priceId, vegetable_id: vegetableId },
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
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

    const currentItem = vegetables[index];
    const aboveItem = vegetables[index - 1];

    await Promise.all([
      updateVegetable(currentItem.id, { sort_order: aboveItem.sort_order }),
      updateVegetable(aboveItem.id, { sort_order: currentItem.sort_order }),
    ]);
  }, [vegetables, updateVegetable]);

  const moveDown = useCallback(async (id: string) => {
    const index = vegetables.findIndex(v => v.id === id);
    if (index === -1 || index >= vegetables.length - 1) return;

    const currentItem = vegetables[index];
    const belowItem = vegetables[index + 1];

    await Promise.all([
      updateVegetable(currentItem.id, { sort_order: belowItem.sort_order }),
      updateVegetable(belowItem.id, { sort_order: currentItem.sort_order }),
    ]);
  }, [vegetables, updateVegetable]);

  const reorderVegetables = useCallback(async (activeId: string, overId: string) => {
    const oldIndex = vegetables.findIndex(v => v.id === activeId);
    const newIndex = vegetables.findIndex(v => v.id === overId);
    
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const newVegetables = [...vegetables];
    const [movedItem] = newVegetables.splice(oldIndex, 1);
    newVegetables.splice(newIndex, 0, movedItem);
    
    const updatedVegetables = newVegetables.map((v, idx) => ({
      ...v,
      sort_order: idx,
    }));
    
    setVegetables(updatedVegetables);

    const credentials = getAdminCredentials();
    if (!credentials) return;

    try {
      const { data, error } = await supabase.functions.invoke('vegetables-admin', {
        body: {
          action: 'reorder',
          username: credentials.username,
          password: credentials.password,
          orders: updatedVegetables.map(v => ({ id: v.id, sort_order: v.sort_order })),
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [vegetables, fetchVegetables]);

  const bulkUpdateVegetables = useCallback(async (items: { id: string; prices: { id: string; price: number; unit: string }[] }[]) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入');

    const now = new Date().toISOString();
    setVegetables(prev => prev.map(v => {
      const item = items.find(i => i.id === v.id);
      if (item) {
        return {
          ...v,
          updated_at: now,
          prices: v.prices.map(p => {
            const updatedPrice = item.prices.find(ip => ip.id === p.id);
            return updatedPrice ? { ...p, price: updatedPrice.price, unit: updatedPrice.unit } : p;
          })
        };
      }
      return v;
    }));
    setLastUpdated(new Date());

    try {
      const { data, error } = await supabase.functions.invoke('vegetables-admin', {
        body: {
          action: 'bulk_update',
          username: credentials.username,
          password: credentials.password,
          vegetable: { items },
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      fetchVegetables();
    } catch (err) {
      await fetchVegetables();
      throw err;
    }
  }, [fetchVegetables]);

  // Build tag order map for sorting
  const tagOrderMap = new Map<string, number>();
  tagOrders.forEach(to => tagOrderMap.set(to.tag_name, to.sort_order));
  const maxTagOrder = tagOrders.length;

  const sortByTag = (a: Vegetable, b: Vegetable) => {
    const statusOrder = (s: string) => s === 'hidden' ? 2 : s === 'out_of_stock' ? 1 : 0;
    const aStatus = statusOrder(a.status);
    const bStatus = statusOrder(b.status);
    if (aStatus !== bStatus) return aStatus - bStatus;
    const aTagOrder = a.tag ? (tagOrderMap.get(a.tag) ?? maxTagOrder) : maxTagOrder + 1;
    const bTagOrder = b.tag ? (tagOrderMap.get(b.tag) ?? maxTagOrder) : maxTagOrder + 1;
    if (aTagOrder !== bTagOrder) return aTagOrder - bTagOrder;
    return a.sort_order - b.sort_order;
  };

  const visibleVegetables = isAdmin 
    ? [...vegetables].sort(sortByTag)
    : vegetables
        .filter(v => v.status !== 'hidden')
        .sort(sortByTag);

  return {
    vegetables,
    visibleVegetables,
    tagOrders,
    lastUpdated,
    isLoading,
    isRefreshing,
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
