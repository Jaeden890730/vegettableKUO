import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/order';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  const fetchCustomers = useCallback(async () => {
    try {
      const credentials = getAdminCredentials();
      
      // If admin credentials exist, use edge function to bypass RLS
      if (credentials) {
        const { data, error } = await supabase.functions.invoke('customer-admin', {
          body: {
            action: 'list_customers',
            username: credentials.username,
            password: credentials.password,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        setCustomers(data.customers as Customer[] || []);
      } else {
        // Fallback to direct query (will be limited by RLS)
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        setCustomers(data as Customer[] || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);


  const createCustomer = async (customerData: {
    name: string;
    phone?: string;
    contact_person?: string;
    settlement_cycle?: 'weekly' | 'monthly';
    note?: string;
    password?: string;
  }) => {
    try {
      const credentials = getAdminCredentials();
      if (!credentials) throw new Error('未登入');

      const { data, error } = await supabase.functions.invoke('customer-admin', {
        body: {
          action: 'create_customer',
          username: credentials.username,
          password: credentials.password,
          customer: {
            name: customerData.name,
            phone: customerData.phone,
            contact_person: customerData.contact_person,
            settlement_cycle: customerData.settlement_cycle || 'monthly',
            note: customerData.note,
            customer_password: customerData.password,
          },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await fetchCustomers();
      return { customer: data.customer, error: null };
    } catch (error) {
      console.error('Error creating customer:', error);
      return { customer: null, error };
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const credentials = getAdminCredentials();
      if (!credentials) throw new Error('未登入');

      const { data, error } = await supabase.functions.invoke('customer-admin', {
        body: {
          action: 'update_customer',
          username: credentials.username,
          password: credentials.password,
          customer: { id, ...updates },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await fetchCustomers();
      return { customer: data.customer, error: null };
    } catch (error) {
      console.error('Error updating customer:', error);
      return { customer: null, error };
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const credentials = getAdminCredentials();
      if (!credentials) throw new Error('未登入');

      const { data, error } = await supabase.functions.invoke('customer-admin', {
        body: {
          action: 'delete_customer',
          username: credentials.username,
          password: credentials.password,
          customer: { id },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await fetchCustomers();
      return { error: null };
    } catch (error) {
      console.error('Error deleting customer:', error);
      return { error };
    }
  };

  const resetPassword = async (id: string, newPhone: string, newPassword: string) => {
    try {
      const credentials = getAdminCredentials();
      if (!credentials) throw new Error('未登入');

      const { data, error } = await supabase.functions.invoke('customer-admin', {
        body: {
          action: 'reset_credentials',
          username: credentials.username,
          password: credentials.password,
          customer: { id, phone: newPhone, new_password: newPassword },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await fetchCustomers();
      return { error: null };
    } catch (error) {
      console.error('Error resetting credentials:', error);
      return { error };
    }
  };

  return {
    customers,
    isLoading,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    resetPassword,
    refetch: fetchCustomers,
  };
}
