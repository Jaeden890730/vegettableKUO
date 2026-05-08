import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, OrderStatus } from '@/types/order';

interface UseOrdersOptions {
  customerId?: string | null;
  isAdmin?: boolean;
}

export function useOrders({ customerId, isAdmin = false }: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
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

  const fetchOrders = useCallback(async (filters?: {
    startDate?: string;
    endDate?: string;
    status?: OrderStatus;
    customerId?: string;
  }) => {
    try {
      const credentials = getAdminCredentials();
      
      // If admin mode and has credentials, use edge function to bypass RLS
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'list_orders',
            username: credentials.username,
            password: credentials.password,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        let orders = data.orders || [];
        
        // Apply client-side filters
        if (filters?.customerId) {
          orders = orders.filter((o: Order) => o.customer_id === filters.customerId);
        }
        if (filters?.startDate) {
          orders = orders.filter((o: Order) => o.order_date >= filters.startDate!);
        }
        if (filters?.endDate) {
          orders = orders.filter((o: Order) => o.order_date <= filters.endDate!);
        }
        if (filters?.status) {
          orders = orders.filter((o: Order) => o.status === filters.status);
        }
        
        setOrders(orders as Order[]);
      } else {
        // Regular query (will be limited by RLS)
        let query = supabase
          .from('orders')
          .select(`
            *,
            customer:customers(*),
            order_items(
              *,
              vegetable:vegetables(name)
            )
          `)
          .order('created_at', { ascending: false });

        if (!isAdmin && customerId) {
          query = query.eq('customer_id', customerId);
        }

        if (filters?.customerId) {
          query = query.eq('customer_id', filters.customerId);
        }

        if (filters?.startDate) {
          query = query.gte('order_date', filters.startDate);
        }

        if (filters?.endDate) {
          query = query.lte('order_date', filters.endDate);
        }

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) throw error;
        setOrders(data as Order[] || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, isAdmin]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = async (orderData: {
    customer_id: string;
    delivery_date?: string;
    note?: string;
    items: {
      vegetable_id?: string;
      custom_item_name?: string;
      quantity: number;
      unit: string;
      packs?: number;
      note?: string;
    }[];
  }) => {
    try {
      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number');

      if (orderNumberError) throw orderNumberError;

      // Create order
      const { data: orderData2, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumberData,
          customer_id: orderData.customer_id,
          delivery_date: orderData.delivery_date,
          note: orderData.note,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: orderData2.id,
        vegetable_id: item.vegetable_id || null,
        custom_item_name: item.custom_item_name || null,
        quantity: item.quantity,
        unit: item.unit,
        packs: item.packs || 1,
        note: item.note || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await fetchOrders();
      return { order: orderData2, error: null };
    } catch (error) {
      console.error('Error creating order:', error);
      return { order: null, error };
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
      return { error: null };
    } catch (error) {
      console.error('Error updating order status:', error);
      return { error };
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const credentials = getAdminCredentials();
      
      // If admin with credentials, use edge function to bypass RLS
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'delete_order',
            username: credentials.username,
            password: credentials.password,
            orderId,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        await fetchOrders();
        return { error: null };
      }
      
      // Fallback to direct query (subject to RLS)
      // Delete order items first
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Then delete order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
      return { error: null };
    } catch (error) {
      console.error('Error deleting order:', error);
      return { error };
    }
  };

  const updateOrderItems = async (orderId: string, items: {
    id: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    packs?: number;
  }[], merchantNote?: string, newItems?: {
    vegetable_id?: string;
    custom_item_name?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    packs?: number;
  }[], deletedItemIds?: string[], extraOrderUpdate?: { customerId?: string; deliveryDate?: string | null }) => {
    try {
      const credentials = getAdminCredentials();
      
      if (isAdmin && credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'update_order_items',
            username: credentials.username,
            password: credentials.password,
            orderId,
            items,
            merchantNote,
            newItems,
            deletedItemIds,
            customerId: extraOrderUpdate?.customerId,
            deliveryDate: extraOrderUpdate?.deliveryDate,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        await fetchOrders();
        return { error: null };
      }
      
      // Fallback to direct query
      if (deletedItemIds && deletedItemIds.length > 0) {
        for (const itemId of deletedItemIds) {
          await supabase.from('order_items').delete().eq('id', itemId);
        }
      }

      for (const item of items) {
        const updatePayload: any = {
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
        };
        if (item.packs !== undefined && item.packs !== null) {
          updatePayload.packs = item.packs;
        }
        const { error } = await supabase
          .from('order_items')
          .update(updatePayload)
          .eq('id', item.id);

        if (error) throw error;
      }

      if (newItems && newItems.length > 0) {
        for (const item of newItems) {
          await supabase.from('order_items').insert({
            order_id: orderId,
            vegetable_id: item.vegetable_id || null,
            custom_item_name: item.custom_item_name || null,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unitPrice || 0,
            packs: item.packs || 1,
          });
        }
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      if (merchantNote !== undefined) {
        updateData.merchant_note = merchantNote;
      }
      if (extraOrderUpdate?.customerId) {
        updateData.customer_id = extraOrderUpdate.customerId;
      }
      if (extraOrderUpdate?.deliveryDate !== undefined) {
        updateData.delivery_date = extraOrderUpdate.deliveryDate;
      }

      await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      await fetchOrders();
      return { error: null };
    } catch (error) {
      console.error('Error updating order items:', error);
      return { error };
    }
  };

  return {
    orders,
    isLoading,
    fetchOrders,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    updateOrderItems,
    refetch: fetchOrders,
  };
}