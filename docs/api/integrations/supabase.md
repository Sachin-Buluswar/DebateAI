# Supabase API Reference

> **Status:** 🚧 Draft – work in progress

## Overview

This document collects the most frequently used Supabase API calls and patterns in **DebateAI**.

We rely on **Supabase v2 (`@supabase/supabase-js`)** for both client-side and server-side operations.

- **Auth** – user sign-up, login, session handling
- **Database** – PostgREST queries for CRUD
- **Row-Level Security (RLS)** – ensure users can only access their own data

Official docs:
- https://supabase.com/docs/reference/javascript
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/auth/row-level-security

---

## Authentication

| Action | Function | Notes |
| ------ | -------- | ----- |
| Sign up | `supabase.auth.signUp({ email, password })` | Use email link templates in `src/app/api/auth-email-templates/` |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` | |
| Sign out | `supabase.auth.signOut()` | |
| Get current session | `supabase.auth.getSession()` | Prefer server-side check in middleware |
| Listen to auth changes | `supabase.auth.onAuthStateChange()` | Useful in React context provider |

### Example

```ts
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient()

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secret'
})
```

---

## Database CRUD

Common query patterns using PostgREST syntax.

```ts
// fetch debates for current user
const { data: debates } = await supabase
  .from('debates')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

```ts
// insert new debate row
await supabase.from('debates').insert({
  user_id: user.id,
  topic: "AI Regulation",
  status: 'pending'
})
```

Refer to the official PostgREST docs for advanced filters, full-text search, and joins.

---

## Admin (Service Role) Client

Server-side modules create an **admin** client that bypasses RLS:

```ts
import { createClient } from '@supabase/supabase-js'
import { env } from '@/shared/env'

export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)
```

Only use this client in isolated backend modules, never in the browser.

---

## Row-Level Security

All tables enabling RLS must have policies defined. See migrations in `migrations/` folder, e.g., `0007_enable_rls_and_policies.sql`.

**Debugging tip:** Use the [Supabase Dashboard Policies tab](https://app.supabase.com) to test queries as an anonymous user. 