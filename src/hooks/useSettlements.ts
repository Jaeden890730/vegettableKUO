import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settlement, SettlementItem, SettlementStatus, Payment, PaymentMethod } from '@/types/order';

interface UseSettlementsOptions {
  customerId?: string | null;
  isAdmin?: boolean;
}

export function useSettlements({ customerId, isAdmin = false }: UseSettlementsOptions = {}) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAdminCredentials = () => {
    const credentials = sessionStorage.getItem('adminCredentials');
    if (!credentials) return null;
    try {
      return JSON.parse(credentials);
    } catch {
      return null;
    }
  };

  const fetchSettlements = useCallback(async (filters?: {
    status?: SettlementStatus;
    customerId?: string;
  }) => {
    try {
      const credentials = getAdminCredentials();
      
      // If admin mode and has credentials, use edge function to bypass RLS
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'list_settlements',
            username: credentials.username,
            password: credentials.password,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        let settlements = data.settlements || [];
        
        // Apply client-side filters
        if (filters?.customerId) {
          settlements = settlements.filter((s: Settlement) => s.customer_id === filters.customerId);
        }
        if (filters?.status) {
          settlements = settlements.filter((s: Settlement) => s.status === filters.status);
        }
        
        setSettlements(settlements as Settlement[]);
      } else {
        // Regular query (will be limited by RLS)
        let query = supabase
          .from('settlements')
          .select(`
            *,
            customer:customers(*),
            settlement_items(*),
            payments(*)
          `)
          .order('created_at', { ascending: false });

        if (!isAdmin && customerId) {
          query = query.eq('customer_id', customerId);
        }

        if (filters?.customerId) {
          query = query.eq('customer_id', filters.customerId);
        }

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) throw error;
        setSettlements(data as Settlement[] || []);
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, isAdmin]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const createSettlement = async (settlementData: {
    customer_id: string;
    period_start: string;
    period_end: string;
    note?: string;
  }) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        // Use edge function to bypass RLS
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'create_settlement',
            username: credentials.username,
            password: credentials.password,
            settlement: settlementData,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        await fetchSettlements();
        return { settlement: data.settlement, error: null };
      } else {
        // Fallback to direct query (will likely fail due to RLS)
        const { data: settlementNumberData, error: settlementNumberError } = await supabase
          .rpc('generate_settlement_number');

        if (settlementNumberError) throw settlementNumberError;

        const { data, error } = await supabase
          .from('settlements')
          .insert({
            settlement_number: settlementNumberData,
            customer_id: settlementData.customer_id,
            period_start: settlementData.period_start,
            period_end: settlementData.period_end,
            note: settlementData.note,
            status: 'draft',
          })
          .select()
          .single();

        if (error) throw error;
        await fetchSettlements();
        return { settlement: data, error: null };
      }
    } catch (error) {
      console.error('Error creating settlement:', error);
      return { settlement: null, error };
    }
  };

  const updateSettlement = async (id: string, updates: Partial<Settlement>) => {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchSettlements();
      return { settlement: data, error: null };
    } catch (error) {
      console.error('Error updating settlement:', error);
      return { settlement: null, error };
    }
  };

  const updateSettlementItem = async (id: string, updates: {
    settlement_quantity?: number;
    settlement_unit_price?: number;
    note?: string;
  }) => {
    try {
      const subtotal = Math.round((updates.settlement_quantity ?? 0) * (updates.settlement_unit_price ?? 0));
      
      const { data, error } = await supabase
        .from('settlement_items')
        .update({
          ...updates,
          subtotal,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Recalculate settlement total
      const { data: settlement } = await supabase
        .from('settlement_items')
        .select('settlement_id, subtotal')
        .eq('id', id)
        .single();

      if (settlement) {
        const { data: allItems } = await supabase
          .from('settlement_items')
          .select('subtotal')
          .eq('settlement_id', settlement.settlement_id);

        const newTotal = allItems?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0;

        await supabase
          .from('settlements')
          .update({ total_amount: newTotal })
          .eq('id', settlement.settlement_id);
      }

      await fetchSettlements();
      return { item: data, error: null };
    } catch (error) {
      console.error('Error updating settlement item:', error);
      return { item: null, error };
    }
  };

  const addSettlementItem = async (settlementId: string, item: {
    item_name: string;
    settlement_quantity: number;
    settlement_unit: string;
    settlement_unit_price: number;
    note?: string;
  }) => {
    try {
      const subtotal = Math.round(item.settlement_quantity * item.settlement_unit_price);

      const { data, error } = await supabase
        .from('settlement_items')
        .insert({
          settlement_id: settlementId,
          ...item,
          subtotal,
        })
        .select()
        .single();

      if (error) throw error;

      // Update settlement total
      const { data: allItems } = await supabase
        .from('settlement_items')
        .select('subtotal')
        .eq('settlement_id', settlementId);

      const newTotal = allItems?.reduce((sum, i) => sum + Number(i.subtotal), 0) || 0;

      await supabase
        .from('settlements')
        .update({ total_amount: newTotal })
        .eq('id', settlementId);

      await fetchSettlements();
      return { item: data, error: null };
    } catch (error) {
      console.error('Error adding settlement item:', error);
      return { item: null, error };
    }
  };

  const deleteSettlementItem = async (id: string) => {
    try {
      // Get settlement_id before delete
      const { data: item } = await supabase
        .from('settlement_items')
        .select('settlement_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('settlement_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update settlement total
      if (item) {
        const { data: allItems } = await supabase
          .from('settlement_items')
          .select('subtotal')
          .eq('settlement_id', item.settlement_id);

        const newTotal = allItems?.reduce((sum, i) => sum + Number(i.subtotal), 0) || 0;

        await supabase
          .from('settlements')
          .update({ total_amount: newTotal })
          .eq('id', item.settlement_id);
      }

      await fetchSettlements();
      return { error: null };
    } catch (error) {
      console.error('Error deleting settlement item:', error);
      return { error };
    }
  };

  const addPayment = async (paymentData: {
    settlement_id: string;
    payment_date: string;
    amount: number;
    payment_method: PaymentMethod;
    note?: string;
  }) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'add_payment',
            username: credentials.username,
            password: credentials.password,
            payment: paymentData,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        await fetchSettlements();
        return { payment: data.payment, error: null };
      }
      
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) throw error;

      await fetchSettlements();
      return { payment: data, error: null };
    } catch (error) {
      console.error('Error adding payment:', error);
      return { payment: null, error };
    }
  };

  const updatePayment = async (id: string, updates: {
    payment_date?: string;
    amount?: number;
    payment_method?: PaymentMethod;
    note?: string;
  }) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'update_payment',
            username: credentials.username,
            password: credentials.password,
            payment: { id, ...updates },
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        await fetchSettlements();
        return { payment: data.payment, error: null };
      }
      
      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchSettlements();
      return { payment: data, error: null };
    } catch (error) {
      console.error('Error updating payment:', error);
      return { payment: null, error };
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'delete_payment',
            username: credentials.username,
            password: credentials.password,
            payment: { id },
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        await fetchSettlements();
        return { error: null };
      }
      
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchSettlements();
      return { error: null };
    } catch (error) {
      console.error('Error deleting payment:', error);
      return { error };
    }
  };

  const deleteSettlement = async (id: string) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        // Use edge function to bypass RLS
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'delete_settlement',
            username: credentials.username,
            password: credentials.password,
            settlement: { id },
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        await fetchSettlements();
        return { error: null };
      } else {
        // Fallback to direct query
        const { error: itemsError } = await supabase
          .from('settlement_items')
          .delete()
          .eq('settlement_id', id);

        if (itemsError) throw itemsError;

        const { error: paymentsError } = await supabase
          .from('payments')
          .delete()
          .eq('settlement_id', id);

        if (paymentsError) throw paymentsError;

        const { error } = await supabase
          .from('settlements')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchSettlements();
        return { error: null };
      }
    } catch (error) {
      console.error('Error deleting settlement:', error);
      return { error };
    }
  };

  // Create settlement from a single order
  const createSettlementFromOrder = async (orderId: string) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        // Use edge function to bypass RLS
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'create_settlement_from_order',
            username: credentials.username,
            password: credentials.password,
            orderId,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        await fetchSettlements();
        return { settlement: data.settlement, error: null };
      } else {
        // Fallback to direct query
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(
              id,
              vegetable_id,
              custom_item_name,
              quantity,
              unit,
              packs,
              unit_price,
              vegetable:vegetables(name, price)
            )
          `)
          .eq('id', orderId)
          .maybeSingle();

        if (orderError) throw orderError;
        if (!orderData) throw new Error('訂單不存在');

        const { data: settlementNumberData, error: settlementNumberError } = await supabase
          .rpc('generate_settlement_number');

        if (settlementNumberError) throw settlementNumberError;

        const { data, error } = await supabase
          .from('settlements')
          .insert({
            settlement_number: settlementNumberData,
            customer_id: orderData.customer_id,
            period_start: orderData.order_date,
            period_end: orderData.order_date,
            note: `來源訂單: ${orderData.order_number}`,
            status: 'draft',
          })
          .select()
          .single();

        if (error) throw error;

        const settlementItems = orderData.order_items?.map((item: any) => {
          const unitPrice = Number(item.unit_price) || Number(item.vegetable?.price) || 0;
          const itemName = item.custom_item_name || item.vegetable?.name || '未知品項';
          const packs = Number(item.packs) || 1;
          const totalQuantity = Number(item.quantity) * packs;
          return {
            settlement_id: data.id,
            order_item_id: item.id,
            item_name: itemName,
            settlement_quantity: totalQuantity,
            settlement_unit: item.unit,
            settlement_unit_price: unitPrice,
            subtotal: Math.round(totalQuantity * unitPrice),
          };
        }) || [];

        if (settlementItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('settlement_items')
            .insert(settlementItems);

          if (itemsError) throw itemsError;

          const totalAmount = settlementItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
          await supabase
            .from('settlements')
            .update({ total_amount: totalAmount })
            .eq('id', data.id);
        }

        await fetchSettlements();
        return { settlement: data, error: null };
      }
    } catch (error) {
      console.error('Error creating settlement from order:', error);
      return { settlement: null, error };
    }
  };

  // Calculate statistics using rounded subtotals
  const getStats = useCallback(() => {
    const outstanding = settlements
      .filter(s => s.status !== 'paid')
      .reduce((sum, s) => {
        // Calculate rounded total from settlement items
        const roundedTotal = s.settlement_items?.reduce(
          (itemSum, item) => itemSum + Math.round(Number(item.subtotal)), 0
        ) || Number(s.total_amount);
        return sum + (roundedTotal - Number(s.paid_amount));
      }, 0);

    const paid = settlements
      .reduce((sum, s) => sum + Number(s.paid_amount), 0);

    return { outstanding, paid };
  }, [settlements]);

  const createSettlementFromOrders = async (orderIds: string[]) => {
    try {
      const credentials = getAdminCredentials();
      if (!isAdmin || !credentials) {
        return { settlement: null, error: new Error('需要管理員權限') };
      }
      const { data, error } = await supabase.functions.invoke('customer-admin', {
        body: {
          action: 'create_settlement_from_orders',
          username: credentials.username,
          password: credentials.password,
          orderIds,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      await fetchSettlements();
      return { settlement: data.settlement, error: null };
    } catch (error) {
      console.error('Error creating settlement from orders:', error);
      return { settlement: null, error };
    }
  };

  return {
    settlements,
    isLoading,
    fetchSettlements,
    createSettlement,
    createSettlementFromOrder,
    createSettlementFromOrders,
    updateSettlement,
    updateSettlementItem,
    addSettlementItem,
    deleteSettlementItem,
    deleteSettlement,
    addPayment,
    updatePayment,
    deletePayment,
    getStats,
    refetch: fetchSettlements,
  };
}
