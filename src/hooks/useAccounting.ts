import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AccountingEntryType = 'income' | 'expense' | 'purchase';

export interface AccountingEntry {
  id: string;
  entry_date: string;
  entry_type: AccountingEntryType;
  category: string;
  item_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface AccountingStats {
  totalIncome: number;
  totalExpense: number;
  totalPurchase: number;
  profit: number;
  byCategory: Record<string, number>;
}

interface UseAccountingOptions {
  startDate?: string;
  endDate?: string;
}

export function useAccounting({ startDate, endDate }: UseAccountingOptions = {}) {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAdminCredentials = () => {
    const credentials = sessionStorage.getItem('adminCredentials');
    if (!credentials) return null;
    try {
      return JSON.parse(credentials) as { username: string; password: string };
    } catch {
      return null;
    }
  };

  const invokeAccountingAdmin = async <T,>(body: Record<string, unknown>) => {
    const credentials = getAdminCredentials();
    if (!credentials) throw new Error('未登入管理後台');

    const { data, error } = await supabase.functions.invoke('accounting-admin', {
      body: {
        ...body,
        username: credentials.username,
        password: credentials.password,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || '操作失敗');
    return data.data as T;
  };

  const fetchEntries = useCallback(async (filters?: {
    startDate?: string;
    endDate?: string;
    entryType?: AccountingEntryType;
  }) => {
    try {
      setIsLoading(true);

      const start = filters?.startDate || startDate;
      const end = filters?.endDate || endDate;

      const data = await invokeAccountingAdmin<AccountingEntry[]>({
        action: 'list',
        filters: {
          startDate: start,
          endDate: end,
          entryType: filters?.entryType,
        },
      });

      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching accounting entries:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const createEntry = async (entryData: {
    entry_date: string;
    entry_type: AccountingEntryType;
    category: string;
    item_name?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    amount: number;
    note?: string;
  }) => {
    try {
      const entry = await invokeAccountingAdmin<AccountingEntry>({
        action: 'create',
        entry: {
          entry_date: entryData.entry_date,
          entry_type: entryData.entry_type,
          category: entryData.category,
          item_name: entryData.item_name || null,
          quantity: entryData.quantity ?? null,
          unit: entryData.unit || null,
          unit_price: entryData.unit_price ?? null,
          amount: entryData.amount,
          note: entryData.note || null,
        },
      });

      await fetchEntries();
      return { entry, error: null };
    } catch (error) {
      console.error('Error creating entry:', error);
      return { entry: null, error };
    }
  };

  const createBulkEntries = async (entriesData: Array<{
    entry_date: string;
    entry_type: AccountingEntryType;
    category: string;
    item_name?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    amount: number;
    note?: string;
  }>) => {
    try {
      const formattedEntries = entriesData.map(e => ({
        entry_date: e.entry_date,
        entry_type: e.entry_type,
        category: e.category,
        item_name: e.item_name || null,
        quantity: e.quantity ?? null,
        unit: e.unit || null,
        unit_price: e.unit_price ?? null,
        amount: e.amount,
        note: e.note || null,
      }));

      const data = await invokeAccountingAdmin<AccountingEntry[]>({
        action: 'bulk_create',
        entry: formattedEntries,
      });

      await fetchEntries();
      return { entries: data, error: null };
    } catch (error) {
      console.error('Error creating bulk entries:', error);
      return { entries: null, error };
    }
  };

  const updateEntry = async (id: string, updates: Partial<AccountingEntry>) => {
    try {
      await invokeAccountingAdmin({
        action: 'update',
        id,
        updates,
      });

      await fetchEntries();
      return { error: null };
    } catch (error) {
      console.error('Error updating entry:', error);
      return { error };
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await invokeAccountingAdmin({
        action: 'delete',
        id,
      });

      await fetchEntries();
      return { error: null };
    } catch (error) {
      console.error('Error deleting entry:', error);
      return { error };
    }
  };

  const getStats = useCallback((data: AccountingEntry[] = entries): AccountingStats => {
    const totalIncome = data
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalExpense = data
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalPurchase = data
      .filter(e => e.entry_type === 'purchase')
      .reduce((sum, e) => sum + e.amount, 0);

    const byCategory: Record<string, number> = {};
    data.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    return {
      totalIncome,
      totalExpense,
      totalPurchase,
      profit: totalIncome - totalExpense - totalPurchase,
      byCategory,
    };
  }, [entries]);

  return {
    entries,
    isLoading,
    fetchEntries,
    createEntry,
    createBulkEntries,
    updateEntry,
    deleteEntry,
    getStats,
    refetch: fetchEntries,
  };
}
