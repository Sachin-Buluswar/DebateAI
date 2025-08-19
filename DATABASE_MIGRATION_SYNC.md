# 🔄 Database Migration Synchronization Guide

## Problem Detected
Your local migrations are out of sync with the production database. The remote database has migrations that don't exist locally, suggesting either:
1. Migrations were run directly in production (not recommended)
2. Multiple developers are working without syncing
3. Migration files were lost or not committed

## Remote Migrations Not Found Locally
```
20250413114200_speech_feedback_sessions
20250715110000_add_admin_columns  
20250715120000_add_soft_delete
20250715130000_add_audit_triggers
20250715140000_add_performance_indexes
```

## Step 1: Pull Remote Schema (IMMEDIATE)

```bash
# First, backup your local migrations
cp -r supabase/migrations supabase/migrations_backup_$(date +%Y%m%d)

# Pull the current production schema
npx supabase db pull

# This will:
# 1. Connect to your remote database
# 2. Generate migration files for remote changes
# 3. Update your local schema.sql
```

## Step 2: Review Generated Migrations

After pulling, check the new migration files:

```bash
# List new migrations
ls -la supabase/migrations/

# Review each new migration
cat supabase/migrations/[timestamp]_*.sql
```

## Step 3: Test Locally

```bash
# Reset local database with new migrations
npx supabase db reset

# Start local Supabase
npx supabase start

# Test your application locally
npm run dev
```

## Step 4: Commit Migration Files

```bash
# Add all migration files to git
git add supabase/migrations/

# Commit with clear message
git commit -m "sync: pull production database migrations

- Added missing migration files from production
- Synchronized local schema with remote
- Includes speech_feedback_sessions and admin features"

# Push to feature branch
git push origin feature/add-migrations-auth
```

## Step 5: Future Migration Workflow

### ✅ Correct Workflow
```bash
# 1. Create migration locally
npx supabase migration new feature_name

# 2. Write SQL in the migration file
# supabase/migrations/[timestamp]_feature_name.sql

# 3. Test locally
npx supabase db reset

# 4. Commit to git
git add supabase/migrations/
git commit -m "feat: add feature_name migration"

# 5. Deploy to production (after merge)
npx supabase db push
```

### ❌ Never Do This
```sql
-- DON'T run SQL directly in production dashboard
-- DON'T create migrations without committing to git
-- DON'T skip local testing
```

## Step 6: Set Up CI/CD for Migrations

Add to your GitHub Actions:

```yaml
name: Deploy Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        
      - name: Deploy Migrations
        run: |
          npx supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          npx supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Step 7: Team Synchronization

### For Team Development

1. **Migration Lock File**: Create `supabase/migrations.lock`
```json
{
  "lastSync": "2025-01-17T10:00:00Z",
  "syncedBy": "developer@example.com",
  "productionVersion": "20250715140000"
}
```

2. **Pre-commit Hook**: Add to `.husky/pre-commit`
```bash
#!/bin/sh
# Check for migration conflicts
if git diff --cached --name-only | grep -q "supabase/migrations"; then
  echo "⚠️  Migration files detected. Ensure you've pulled latest migrations!"
  echo "Run: npx supabase db pull"
fi
```

3. **Daily Sync Routine**
```bash
# Every morning, run:
git pull origin main
npx supabase db pull
npx supabase db reset
```

## Common Issues & Solutions

### Issue 1: "Migration already exists"
```bash
# Solution: Rename your local migration with later timestamp
mv supabase/migrations/20250101_feature.sql \
   supabase/migrations/20250718_feature.sql
```

### Issue 2: "Cannot connect to remote database"
```bash
# Solution: Update your Supabase credentials
npx supabase login
npx supabase link --project-ref [your-project-ref]
```

### Issue 3: "Schema drift detected"
```bash
# Solution: Full resync
npx supabase db remote commit
npx supabase db reset
```

## Monitoring Migration Health

Create this script as `scripts/check-migrations.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkMigrations() {
  console.log('🔍 Checking migration status...\n');
  
  // Get local migrations
  const localDir = path.join(process.cwd(), 'supabase/migrations');
  const localMigrations = fs.readdirSync(localDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log(`📁 Local migrations: ${localMigrations.length}`);
  
  // Get remote migrations (requires supabase CLI)
  try {
    const remote = execSync('npx supabase db remote list', { encoding: 'utf8' });
    const remoteMigrations = remote.split('\n').filter(l => l.includes('.sql'));
    
    console.log(`☁️  Remote migrations: ${remoteMigrations.length}`);
    
    // Find differences
    const localSet = new Set(localMigrations);
    const remoteSet = new Set(remoteMigrations.map(r => r.trim()));
    
    const onlyLocal = [...localSet].filter(m => !remoteSet.has(m));
    const onlyRemote = [...remoteSet].filter(m => !localSet.has(m));
    
    if (onlyLocal.length > 0) {
      console.log('\n⚠️  Migrations only in local:');
      onlyLocal.forEach(m => console.log(`  - ${m}`));
    }
    
    if (onlyRemote.length > 0) {
      console.log('\n⚠️  Migrations only in remote:');
      onlyRemote.forEach(m => console.log(`  - ${m}`));
    }
    
    if (onlyLocal.length === 0 && onlyRemote.length === 0) {
      console.log('\n✅ Migrations are in sync!');
    } else {
      console.log('\n❌ Migrations are out of sync. Run: npx supabase db pull');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to check remote migrations:', error.message);
    process.exit(1);
  }
}

checkMigrations();
```

Add to package.json:
```json
{
  "scripts": {
    "db:check": "node scripts/check-migrations.js",
    "db:sync": "npx supabase db pull && npx supabase db reset",
    "db:deploy": "npx supabase db push"
  }
}
```

## Emergency Recovery

If everything is broken:

```bash
# 1. Export production data
npx supabase db dump -f production_backup.sql

# 2. Create fresh local setup
rm -rf supabase/migrations
npx supabase init

# 3. Pull entire remote schema
npx supabase db pull --schema '*'

# 4. Reset and test
npx supabase db reset

# 5. If good, commit everything
git add -A
git commit -m "fix: complete migration resync from production"
```

## Prevention Checklist

- [ ] Always create migrations locally first
- [ ] Test migrations with `db reset` before pushing
- [ ] Commit migration files immediately after creation
- [ ] Pull remote changes before creating new migrations
- [ ] Use descriptive migration names
- [ ] Document breaking changes in migrations
- [ ] Review migrations in PR before merging
- [ ] Set up automated migration deployment
- [ ] Monitor migration status regularly
- [ ] Keep migration files under 1MB each

---

**Priority**: CRITICAL  
**Time to Fix**: 30 minutes  
**Risk if Ignored**: Database schema drift, failed deployments, data loss  

Remember: Migrations are your database's version control. Treat them with the same care as your code!