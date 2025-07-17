# DebateAI

## 🎯 AI-Powered Debate Training Platform

DebateAI helps you master the art of debate through real-time AI opponents, speech analysis, and evidence search. Practice against 10 unique AI personalities, receive comprehensive feedback, and improve your persuasive speaking skills.

**🚀 Quick Start**: `npm install && npm run dev` → `http://localhost:3001`

---

## ✨ Key Features

### 🎙️ **Real-Time AI Debates**
- **10 Distinct AI Opponents** with unique personalities and debate styles
- **Structured Formats** - Public Forum with proper timing and phases
- **Voice Synthesis** - Natural speech using ElevenLabs technology
- **Interactive Crossfire** - Dynamic Q&A sessions with AI opponents
- **Performance Analysis** - Detailed feedback after each debate

### 📊 **Speech Analysis**
- **Record or Upload** - Browser recording or file upload support
- **AI-Powered Feedback** - Analysis using OpenAI GPT-4o-mini
- **Comprehensive Scoring** - Delivery, arguments, persuasiveness metrics
- **Improvement Tracking** - View progress over time
- **Specific Recommendations** - Actionable tips for improvement

### 🔍 **Evidence Search**
- **Enhanced RAG System** - PDF storage with direct document viewing
- **Multiple Search Modes** - Assistant, RAG, and Enhanced RAG options
- **Context Viewing** - See surrounding text for any search result
- **OpenCaseList Integration** - Access to debate evidence database
- **Search History** - Track and organize your research

### 🔐 **User Features**
- **Secure Authentication** - Email verification and OAuth support
- **Personal Dashboard** - Track debates, speeches, and progress
- **Theme Customization** - Light/dark mode preferences
- **Data Privacy** - Row-level security for all user data

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- ElevenLabs API key

### Quick Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd debatetest2
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   # Open http://localhost:3001
   ```

4. **Create Account & Start Debating!**

For detailed setup instructions, see the [documentation](#documentation) below.

---

## 📖 Documentation

### Quick Links
- **[Production Status](PRODUCTION_STATUS.md)** - Current deployment status and readiness
- **[UI Improvements Roadmap](UI_IMPROVEMENTS_ROADMAP.md)** - Remaining UI/UX work
- **[Architecture Overview](docs/architecture.md)** - System design and components
- **[Development Guide](CLAUDE.md)** - Guidelines for contributors and AI assistants

### API Documentation
- **[Supabase](docs/apis/supabase.md)** - Database, auth, and RLS policies
- **[OpenAI](docs/apis/openai.md)** - GPT-4o-mini and vector storage
- **[ElevenLabs](docs/apis/elevenlabs.md)** - Text-to-speech and speech-to-text
- **[Socket.IO](docs/apis/socketio.md)** - Real-time communication

### Deployment & Operations
- **[CI/CD Setup](docs/CI_CD_SETUP.md)** - GitHub Actions workflows
- **[Deployment Process](docs/DEPLOYMENT_PROCESS.md)** - Production deployment
- **[Monitoring Guide](docs/MONITORING_GUIDE.md)** - Observability setup
- **[Environment Secrets](docs/ENVIRONMENT_SECRETS.md)** - Configuration guide

---

## 🛠️ Detailed Setup

### Environment Variables

```env
# Required - Database & Authentication
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Required - AI Services
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Optional - Enhanced Features
OPENAI_VECTOR_STORE_ID=your_vector_store_id
DEBUG_API_KEY=your_debug_key_for_development
```

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in `supabase/migrations/`
3. Enable Row Level Security on all tables
4. Configure authentication providers as needed

### Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint checking
npm run typecheck    # TypeScript validation
npm run check-env    # Validate environment variables
```

---

## 🏗️ Technology Stack

- **Frontend**: Next.js 14.2.30, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.IO, Supabase (PostgreSQL)
- **AI Services**: OpenAI GPT-4o-mini, ElevenLabs TTS/STT
- **Infrastructure**: Docker, GitHub Actions, OpenTelemetry

---

## 📱 How to Use DebateAI

### 1. **Start a Debate**
- Choose a topic and your position
- Select AI opponents from 10 unique personalities
- Engage in structured Public Forum debate
- Receive comprehensive performance analysis

### 2. **Get Speech Feedback**
- Record or upload your debate speeches
- Receive AI-powered analysis on delivery, arguments, and persuasiveness
- Track improvement over time with detailed metrics
- Get specific recommendations for improvement

### 3. **Search for Evidence**
- Use the enhanced RAG system to find debate evidence
- View PDFs directly and see context around search results
- Access OpenCaseList database for competitive debate evidence
- Save and organize your research

---

## 🚨 Troubleshooting

- **Can't connect?** Check your API keys in `.env.local`
- **Audio not working?** Enable microphone permissions in your browser
- **Errors during setup?** Run `npm run check-env` to validate configuration
- **Need help?** Check the [Troubleshooting Guide](TROUBLESHOOTING.md)

---

## 🤝 Contributing

We welcome contributions! Please read our [Development Guide](CLAUDE.md) for guidelines on:
- Code patterns and best practices
- Git workflow and branch strategy
- Testing and quality standards
- Security requirements

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
