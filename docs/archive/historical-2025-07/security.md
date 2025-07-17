# Security Improvements

This document outlines the recent security hardening steps applied to the DebateAI project and instructions for additional configuration inside Supabase.

## 1. Row-Level Security (RLS)

Following Supabase advisor warnings, RLS has been **enabled and properly configured** for the following tables:

| Table                | Policy Name                      | Purpose |
| -------------------- | -------------------------------- | ------- |
| `public.health_check`  | `health_check_read`               | Allows *read-only* access for all roles; prevents unauthorised writes. |
| `public.debate_sessions` | `debate_sessions_user_access`     | Restricts all access to the session owner (`user_id`) or sessions with `NULL` owner (system essays/test data). |
| `public.debate_speeches` | `debate_speeches_user_access`     | Grants access only when the requesting user also has access to the **parent** `debate_sessions` record. |
| `public.audio_recordings`| `audio_recordings_user_access`    | Mirrors the policy for speeches, scoping access through the parent session. |

The migration file `migrations/0007_enable_rls_and_policies.sql` contains the exact SQL applied.

### How to Roll Back
If necessary, disable the policies by running the opposite `DROP POLICY` / `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` commands from psql or the Supabase SQL editor.

## 2. Leaked Password Protection

Supabase Auth can automatically block compromised passwords using the HaveIBeenPwned (HIBP) API. This feature is currently **disabled by default**.

### Enable in Dashboard
1. Navigate to **Auth → Settings → Passwords** in your Supabase project dashboard.
2. Toggle **"Block leaked passwords"** to **Enabled**.
3. Save changes.

### Enable via SQL (optional)
You can also enable this using SQL:
```sql
-- Requires `supabase_admin` role
call auth.enable_leaked_password_protection();
```

## 3. Other Best Practices

* Rotate and store API keys securely via environment variables (`.env.local` not committed to version control).
* Enforce HTTPS/WSS across all deployments (handled by Vercel for the frontend and Supabase for APIs).
* Review Supabase **Advisors** panel regularly for new findings.
* Maintain **principle of least privilege** when creating additional database roles. 