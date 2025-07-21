# Installation

## Prerequisites
Node.js 18.0+
npm 8.0+
Git
macOS/Linux/Windows WSL

## Required Accounts
Create accounts:
1. https://supabase.com
2. https://platform.openai.com
3. https://elevenlabs.io

## Installation Steps

### 1. Clone Repository
```bash
git clone <repository-url>
cd debatetest2
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Environment File
```bash
cp .env.example .env.local
```

### 4. Database Setup

#### Create Supabase Project
1. Sign in https://app.supabase.com
2. Click "New Project"
3. Enter:
   - Name: Eris Debate
   - Database Password: [generate strong password]
   - Region: [closest to users]
4. Click "Create Project"

#### Run Migrations
1. Open SQL Editor in Supabase Dashboard
2. Execute each file in order from /Users/sachinbuluswar/Documents/debatetest2/supabase/migrations/
3. Verify tables exist: profiles, debates, speeches, search_history

#### Enable RLS
For each table:
1. Table Editor → [table_name] → RLS tab
2. Enable RLS
3. Policies already included in migrations

### 5. Verify Installation
```bash
npm run check-env
```

### 6. Build Verification
```bash
# Verify TypeScript compilation
npm run typecheck

# Verify linting
npm run lint

# Build production bundle
npm run build
```

**Note**: All TypeScript errors have been fixed and the project builds successfully.

### 7. Start Server
```bash
npm run dev
```
Access: http://localhost:3001

## Error Resolution

### Port 3001 in use
```bash
lsof -ti:3001 | xargs kill -9
# OR
PORT=3002 npm run dev
```

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors
```bash
npm run typecheck
```

### Permission errors (macOS/Linux)
```bash
sudo npm install --unsafe-perm
```

## Verification Commands
```bash
# API health check
curl http://localhost:3001/api/health

# Expected response
{"status":"ok","timestamp":"[ISO_DATE]"}
```

## File Locations
Project root: /Users/sachinbuluswar/Documents/debatetest2
Migrations: /Users/sachinbuluswar/Documents/debatetest2/supabase/migrations/
Environment: /Users/sachinbuluswar/Documents/debatetest2/.env.local