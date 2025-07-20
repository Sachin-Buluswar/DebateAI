/**
 * User role types for Role-Based Access Control (RBAC)
 */

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleView {
  user_id: string;
  email: string;
  role: UserRole;
  granted_by: string | null;
  granted_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

/**
 * Role hierarchy for permission checking
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  'user': 0,
  'moderator': 1,
  'admin': 2,
  'super_admin': 3,
};

/**
 * Check if a user role has permission for a required role
 * @param userRole The user's current role
 * @param requiredRole The role required for access
 * @returns true if the user has the required role or higher
 */
export function hasRolePermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Role display names for UI
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  'user': 'User',
  'moderator': 'Moderator',
  'admin': 'Administrator',
  'super_admin': 'Super Administrator',
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  'user': 'Standard user with access to all basic features',
  'moderator': 'Can moderate content and manage community features',
  'admin': 'Can manage documents, users, and system settings',
  'super_admin': 'Full system access including role management',
};