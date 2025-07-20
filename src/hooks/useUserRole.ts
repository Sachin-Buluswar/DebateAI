'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { UserRole, hasRolePermission } from '@/types/auth';
import type { Session } from '@supabase/supabase-js';

interface UseUserRoleReturn {
  role: UserRole | null;
  loading: boolean;
  error: Error | null;
  hasRole: (requiredRole: UserRole) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to get the current user's role and check permissions
 */
export function useUserRole(): UseUserRoleReturn {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const fetchUserRole = async (userId?: string) => {
    if (!userId) {
      setRole('user'); // Default role for non-authenticated users
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the RPC function to get user role
      const { data, error: rpcError } = await supabase
        .rpc('get_user_role');

      if (rpcError) {
        throw rpcError;
      }

      setRole(data || 'user');
    } catch (err) {
      console.error('Error fetching user role:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch user role'));
      setRole('user'); // Default to user role on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchUserRole(session?.user?.id);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchUserRole(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!role) return false;
    return hasRolePermission(role, requiredRole);
  };

  return {
    role,
    loading,
    error,
    hasRole,
    refetch: () => fetchUserRole(session?.user?.id),
  };
}

/**
 * Hook to check if user has a specific role
 * @param requiredRole The role to check for
 * @returns Object with hasRole boolean and loading state
 */
export function useHasRole(requiredRole: UserRole) {
  const { role, loading, error, hasRole } = useUserRole();
  
  return {
    hasRole: hasRole(requiredRole),
    loading,
    error,
    role,
  };
}