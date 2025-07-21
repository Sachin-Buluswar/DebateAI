# Role-Based Access Control (RBAC) Implementation

## Overview

This document describes the Role-Based Access Control (RBAC) system implemented in Eris Debate to replace hardcoded admin checks and provide a secure, scalable permission system.

## Architecture

### Database Schema

The RBAC system is built on the following database structure:

1. **User Roles Enum**: `user_role` type with values:
   - `user` - Standard user with basic access
   - `moderator` - Can moderate content and manage community features
   - `admin` - Can manage documents, users, and system settings
   - `super_admin` - Full system access including role management

2. **Tables**:
   - `user_roles` - Stores user role assignments with optional expiration
   - `user_roles_view` - View for easier role checking in the application

### Role Hierarchy

Roles follow a hierarchical structure:
```
user < moderator < admin < super_admin
```

Users with higher roles automatically have permissions of lower roles.

## Implementation Details

### Database Functions

1. **`check_user_role(required_role)`**: Checks if the current user has the required role or higher
2. **`get_user_role()`**: Returns the current user's role (defaults to 'user' if not found)

### TypeScript Types

Located in `/src/types/auth.ts`:
- `UserRole` - Union type for all roles
- `UserRoleRecord` - Interface for role database records
- `UserRoleView` - Interface for the role view
- Helper functions and constants for role management

### React Hooks

Located in `/src/hooks/useUserRole.ts`:
- `useUserRole()` - Hook to get current user's role and check permissions
- `useHasRole(requiredRole)` - Hook to check if user has a specific role

### Components

1. **`RoleProtectedRoute`** (`/src/components/auth/RoleProtectedRoute.tsx`):
   - Protects routes based on user roles
   - Supports custom loading and unauthorized components
   - Automatically redirects unauthorized users

## Usage Examples

### Protecting a Route

```tsx
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute';

export default function AdminPage() {
  return (
    <RoleProtectedRoute 
      requiredRole="admin"
      unauthorizedComponent={<UnauthorizedMessage />}
    >
      <AdminContent />
    </RoleProtectedRoute>
  );
}
```

### Checking Roles in Components

```tsx
import { useUserRole } from '@/hooks/useUserRole';

function MyComponent() {
  const { role, hasRole, loading } = useUserRole();
  
  if (loading) return <Loading />;
  
  return (
    <div>
      {hasRole('admin') && <AdminFeatures />}
      {hasRole('moderator') && <ModeratorTools />}
      <p>Your role: {role}</p>
    </div>
  );
}
```

### API Route Protection

```typescript
// In API routes
const { data: hasPermission } = await supabase
  .rpc('check_user_role', { required_role: 'admin' });

if (!hasPermission) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

## Migration Guide

### From Hardcoded Checks

Before:
```typescript
const isAdmin = session.user.email === 'admin@atlasdebate.com';
```

After:
```typescript
const { hasRole } = useUserRole();
const isAdmin = hasRole('admin');
```

### Database Migration

Run the migration file:
```sql
/supabase/migrations/20250120_create_user_roles.sql
```

This will:
1. Create the role system tables and functions
2. Set up RLS policies
3. Initialize roles for existing admin users

## Security Considerations

1. **Row Level Security (RLS)**: All role tables have RLS enabled
2. **Function Security**: Database functions use `SECURITY DEFINER` for proper access control
3. **Hierarchical Permissions**: Higher roles automatically include lower role permissions
4. **Expiring Roles**: Support for temporary role assignments with expiration dates

## Managing Roles

### Granting Roles (Super Admin Only)

```sql
INSERT INTO user_roles (user_id, role, granted_by)
VALUES ('user-uuid', 'admin', 'granter-uuid');
```

### Revoking Roles

```sql
DELETE FROM user_roles WHERE user_id = 'user-uuid';
```

### Temporary Roles

```sql
INSERT INTO user_roles (user_id, role, granted_by, expires_at)
VALUES ('user-uuid', 'moderator', 'granter-uuid', NOW() + INTERVAL '30 days');
```

## Future Enhancements

1. **Role Management UI**: Create admin interface for managing user roles
2. **Audit Trail**: Add logging for role changes
3. **Fine-grained Permissions**: Add specific permissions within roles
4. **API Endpoints**: Create REST endpoints for role management
5. **Role-based Feature Flags**: Integrate with feature flag system

## Troubleshooting

### User Always Has 'user' Role

1. Check if the user has an entry in `user_roles` table
2. Verify the role hasn't expired
3. Check RLS policies are properly configured

### Permission Denied Errors

1. Ensure the user is authenticated
2. Check the required role is correctly specified
3. Verify database functions are created with proper permissions

### Performance Issues

1. Ensure indexes are created on `user_id` and `role` columns
2. Consider caching role checks in the application
3. Monitor query performance with EXPLAIN ANALYZE