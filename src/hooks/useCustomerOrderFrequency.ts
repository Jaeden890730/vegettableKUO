import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VegetableFrequency {
  vegetable_id: string;
  count: number;
}

export function useCustomerOrderFrequency(customerId: string | null) {
  const [frequencyMap, setFrequencyMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setIsLoading(false);
      return;
    }

    const fetchFrequency = async () => {
      try {
        // Get all order items for this customer's orders
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            vegetable_id,
            order:orders!inner(customer_id)
          `)
          .eq('order.customer_id', customerId)
          .not('vegetable_id', 'is', null);

        if (error) throw error;

        // Count frequency of each vegetable
        const frequencyCount = new Map<string, number>();
        data?.forEach((item) => {
          if (item.vegetable_id) {
            const current = frequencyCount.get(item.vegetable_id) || 0;
            frequencyCount.set(item.vegetable_id, current + 1);
          }
        });

        setFrequencyMap(frequencyCount);
      } catch (error) {
        console.error('Error fetching order frequency:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFrequency();
  }, [customerId]);

  // Sort function to apply to vegetables array
  const sortByFrequency = useMemo(() => {
    return <T extends { id: string }>(vegetables: T[]): T[] => {
      return [...vegetables].sort((a, b) => {
        const freqA = frequencyMap.get(a.id) || 0;
        const freqB = frequencyMap.get(b.id) || 0;
        // Sort by frequency descending, then by original order for items with same frequency
        if (freqB !== freqA) {
          return freqB - freqA;
        }
        return 0; // Keep original order for same frequency
      });
    };
  }, [frequencyMap]);

  return {
    frequencyMap,
    sortByFrequency,
    isLoading,
  };
}
