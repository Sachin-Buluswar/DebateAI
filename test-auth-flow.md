# Authentication Flow Test Checklist

## Manual Testing Steps

### 1. Sign Up Flow
- [ ] Navigate to `/auth`
- [ ] Click "Don't have an account? Sign Up"
- [ ] Enter new email and password
- [ ] Click Sign Up
- [ ] Verify redirect to dashboard
- [ ] Check that user profile exists in database

### 2. Sign In Flow
- [ ] Sign out if logged in
- [ ] Navigate to `/auth`
- [ ] Enter existing credentials
- [ ] Click Sign In
- [ ] Verify redirect to dashboard
- [ ] Verify no "Checking authentication..." stuck state

### 3. Protected Routes
- [ ] While signed out, try to access `/dashboard`
- [ ] Verify redirect to `/auth?redirect=/dashboard`
- [ ] Sign in
- [ ] Verify redirect back to `/dashboard` (not default dashboard)

### 4. Sign Out Flow
- [ ] While signed in, click Sign Out button
- [ ] Confirm sign out
- [ ] Verify redirect to home page
- [ ] Try accessing protected route
- [ ] Verify redirect to auth page

### 5. Session Persistence
- [ ] Sign in
- [ ] Refresh the page
- [ ] Verify still signed in
- [ ] Close browser tab
- [ ] Open new tab and navigate to app
- [ ] Verify still signed in

### 6. Auth State Synchronization
- [ ] Open app in two tabs
- [ ] Sign out in one tab
- [ ] Verify other tab redirects to auth

### 7. Error Handling
- [ ] Try signing in with wrong password
- [ ] Verify user-friendly error message
- [ ] Try signing up with existing email
- [ ] Verify appropriate error and switch to sign in

## Issues Fixed

### 1. **Sign-in Redirect Issue**
- **Problem**: User stayed on sign-in page after successful auth
- **Root Cause**: Duplicate redirect logic in auth state listener
- **Fix**: Removed duplicate redirect in `onAuthStateChange`, let form handle redirects

### 2. **"Checking authentication..." Infinite Loading**
- **Problem**: Loading state got stuck on protected pages
- **Root Cause**: Not setting `loading` to `false` in all code paths
- **Fix**: Ensured `setLoading(false)` is called in all branches (error, no session, success)

### 3. **Redirect After Auth**
- **Problem**: Always redirected to `/dashboard` regardless of original destination
- **Root Cause**: Not preserving redirect parameter from middleware
- **Fix**: Added `redirectTo` prop to auth form, preserving original destination

### 4. **Cookie Detection**
- **Problem**: Middleware couldn't detect modern Supabase SSR cookies
- **Root Cause**: Looking for old cookie names
- **Fix**: Updated to detect modern cookie pattern `sb-*-auth-token`

### 5. **Race Conditions**
- **Problem**: Auth state changes causing unnecessary redirects
- **Root Cause**: Too aggressive redirect logic in auth state listeners
- **Fix**: Only redirect on explicit SIGNED_OUT event, not on missing session

### 6. **Profile Creation**
- **Problem**: Console warnings in production
- **Root Cause**: Using console.log/warn/error in production
- **Fix**: Wrapped all console statements with NODE_ENV checks

### 7. **Supabase Client Singleton**
- **Problem**: Singleton pattern could cause stale auth state
- **Root Cause**: Single client instance not reflecting auth changes
- **Fix**: Improved client initialization with lazy loading

### 8. **Security Fix**
- **Problem**: Service role key usage in ensure-profile endpoint
- **Root Cause**: Previous implementation used service role key
- **Fix**: Now uses authenticated client with RLS policies

## Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Database Requirements
- `user_profiles` table with RLS policies
- Users should be able to insert/update their own profile
- Profile ID should match auth user ID

## Testing Commands
```bash
# Run the app
npm run dev

# Check for type errors
npm run typecheck

# Check for lint errors
npm run lint
```