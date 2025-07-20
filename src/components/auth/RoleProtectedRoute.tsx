'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHasRole } from '@/hooks/useUserRole';
import { UserRole } from '@/types/auth';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: UserRole;
  fallbackUrl?: string;
  loadingComponent?: React.ReactNode;
  unauthorizedComponent?: React.ReactNode;
}

/**
 * Component to protect routes based on user roles
 */
export function RoleProtectedRoute({
  children,
  requiredRole,
  fallbackUrl = '/',
  loadingComponent = <div>Loading...</div>,
  unauthorizedComponent,
}: RoleProtectedRouteProps) {
  const { hasRole, loading } = useHasRole(requiredRole);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !hasRole) {
      if (!unauthorizedComponent) {
        router.push(fallbackUrl);
      }
    }
  }, [hasRole, loading, router, fallbackUrl, unauthorizedComponent]);

  if (loading) {
    return <>{loadingComponent}</>;
  }

  if (!hasRole) {
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }
    return null; // Will redirect
  }

  return <>{children}</>;
}