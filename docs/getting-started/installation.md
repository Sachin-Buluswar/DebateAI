# Installation Guide

This guide walks you through installing DebateAI on your local development environment.

## System Requirements

### Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (comes with Node.js)
- **Git**: For cloning the repository
- **Operating System**: macOS, Linux, or Windows with WSL

### Required Accounts

Before you begin, you'll need to create accounts for the following services:

1. **[Supabase](https://supabase.com)** - For database and authentication
2. **[OpenAI](https://platform.openai.com)** - For AI debate opponents and speech analysis
3. **[ElevenLabs](https://elevenlabs.io)** - For text-to-speech and speech-to-text

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd debatetest2
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 14.2.30 and React 18
- TypeScript and Tailwind CSS
- Socket.IO for real-time communication
- Supabase client libraries
- OpenAI and ElevenLabs SDKs

### 3. Set Up Environment Variables

Create a local environment file from the template:

```bash
cp .env.example .env.local
```

You'll configure these variables in the next step. See the [Configuration Guide](./configuration.md) for detailed instructions.

### 4. Database Setup

#### Create Supabase Project

1. Sign in to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: DebateAI (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create Project"

#### Run Database Migrations

Once your project is ready:

1. Navigate to the SQL Editor in Supabase Dashboard
2. Run each migration file in order from `supabase/migrations/`
3. Verify tables are created:
   - `profiles`
   - `debates`
   - `speeches`
   - `search_history`

#### Enable Row Level Security

For each table:

1. Go to Table Editor
2. Click on the table
3. Navigate to "RLS" tab
4. Enable RLS
5. Add the appropriate policies (included in migration files)

### 5. Verify Installation

Run the environment check script:

```bash
npm run check-env
```

This will verify:
- All required environment variables are set
- API keys are in the correct format
- Node.js version meets requirements

### 6. Start Development Server

```bash
npm run dev
```

The application will start on:
- **Application**: http://localhost:3001
- **Socket.IO Server**: http://localhost:3001 (integrated)

## Troubleshooting Installation

### Common Issues

#### Port Already in Use
If port 3001 is already in use:
```bash
# Find process using port
lsof -ti:3001 

# Or use a different port
PORT=3002 npm run dev
```

#### Module Not Found Errors
Clear the cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Errors
Ensure TypeScript is properly configured:
```bash
npm run typecheck
```

#### Permission Errors (macOS/Linux)
If you encounter permission errors:
```bash
sudo npm install --unsafe-perm
```

### Verification Steps

After installation, verify everything is working:

1. **Check API Health**:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Test Database Connection**:
   - Navigate to http://localhost:3001
   - The page should load without connection errors

3. **Verify WebSocket**:
   - Open browser console
   - Should see "Socket connected" message when accessing debate page

## Next Steps

Once installation is complete:

1. [Configure your environment](./configuration.md) with API keys and settings
2. Follow the [Quick Start Guide](./quick-start.md) to create your first debate
3. Review the [Development Guide](../../CLAUDE.md) for best practices

## Additional Resources

- [Architecture Overview](../architecture.md)
- [Troubleshooting Guide](../../TROUBLESHOOTING.md)
- [Production Deployment](../DEPLOYMENT_PROCESS.md)