import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'customer' | null;

// Simple in-memory cache to prevent duplicate requests
const cache = {
  role: new Map<string, UserRole>(),
  customer: new Map<string, { id: string | null; name: string | null }>(),
};

// Shared state across all hook instances
interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole;
  customerId: string | null;
  customerName: string | null;
  isLoading: boolean;
}

let sharedState: AuthState = {
  user: null,
  session: null,
  role: null,
  customerId: null,
  customerName: null,
  isLoading: true,
};

// Track initialization
let initialized = false;
let initPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function getSnapshot(): AuthState {
  return sharedState;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  // Create new object reference to trigger re-render
  sharedState = { ...sharedState };
  listeners.forEach(listener => listener());
}

async function fetchUserRole(userId: string): Promise<UserRole> {
  if (cache.role.has(userId)) {
    return cache.role.get(userId)!;
  }

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    const role = (data?.role as UserRole) || null;
    cache.role.set(userId, role);
    return role;
  } catch (err) {
    console.error('Error in fetchUserRole:', err);
    return null;
  }
}

async function fetchCustomerData(userId: string): Promise<{ id: string | null; name: string | null }> {
  if (cache.customer.has(userId)) {
    return cache.customer.get(userId)!;
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching customer data:', error);
      return { id: null, name: null };
    }

    const result = { id: data?.id || null, name: data?.name || null };
    cache.customer.set(userId, result);
    return result;
  } catch (err) {
    console.error('Error in fetchCustomerData:', err);
    return { id: null, name: null };
  }
}

async function loadUserData(user: User) {
  const userRole = await fetchUserRole(user.id);
  sharedState.role = userRole;

  if (userRole === 'customer') {
    const custData = await fetchCustomerData(user.id);
    sharedState.customerId = custData.id;
    sharedState.customerName = custData.name;
  } else {
    sharedState.customerId = null;
    sharedState.customerName = null;
  }
}

function clearState() {
  sharedState = {
    user: null,
    session: null,
    role: null,
    customerId: null,
    customerName: null,
    isLoading: false,
  };
}

// Initialize auth once - optimized version
function initAuth(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (initialized) return;
    initialized = true;

    // Get initial session first
    let initialSessionToken: string | undefined;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      initialSessionToken = session?.access_token;
      sharedState.session = session;
      sharedState.user = session?.user ?? null;

      if (session?.user) {
        await loadUserData(session.user);
      }
    } catch (err) {
      console.error('Error getting session:', err);
    }
    
    sharedState.isLoading = false;
    notifyListeners();

    // Set up auth state listener AFTER initial session to avoid duplicate calls
    supabase.auth.onAuthStateChange((event, session) => {
      // Skip if this is the same session we already loaded
      if (session?.access_token === initialSessionToken) {
        initialSessionToken = undefined; // Only skip once
        return;
      }
      // Skip if state hasn't actually changed
      if (sharedState.session?.access_token === session?.access_token) {
        return;
      }

      sharedState.session = session;
      sharedState.user = session?.user ?? null;

      if (session?.user) {
        loadUserData(session.user).then(() => {
          sharedState.isLoading = false;
          notifyListeners();
        });
      } else {
        clearState();
        notifyListeners();
      }
    });
  })();

  return initPromise;
}

// Start initialization immediately when module loads
initAuth();

export function useSupabaseAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const signIn = useCallback(async (phone: string, password: string) => {
    const email = `${phone}@customer.local`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    return { data, error: null };
  }, []);

  const signOut = useCallback(async () => {
    cache.role.clear();
    cache.customer.clear();
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    clearState();
    notifyListeners();
  }, []);

  return useMemo(() => ({
    user: state.user,
    session: state.session,
    role: state.role,
    customerId: state.customerId,
    customerName: state.customerName,
    isLoading: state.isLoading,
    isAdmin: state.role === 'admin',
    isCustomer: state.role === 'customer',
    isAuthenticated: !!state.user,
    signIn,
    signOut,
  }), [state, signIn, signOut]);
}
