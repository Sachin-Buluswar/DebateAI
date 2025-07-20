'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { UserRole, hasRolePermission } from '@/types/auth';

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
  const supabase = useSupabaseClient();
  const session = useSession();

  const fetchUserRole = async () => {
    if (!session?.user?.id) {
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
    fetchUserRole();
  }, [session?.user?.id]);

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!role) return false;
    return hasRolePermission(role, requiredRole);
  };

  return {
    role,
    loading,
    error,
    hasRole,
    refetch: fetchUserRole,
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