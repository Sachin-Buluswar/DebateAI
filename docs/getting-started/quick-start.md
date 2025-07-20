# Quick Start

## Prerequisites
Completed installation.md
Completed configuration.md

## Start Application
```bash
npm run dev
```
Open: http://localhost:3001

## Create Account

### Sign Up
1. Click "Sign Up"
2. Enter email and password
3. Check email for confirmation link
4. Click confirmation link

### Sign In
1. Enter credentials
2. Redirected to dashboard

## First Debate

### 1. Start Debate
Click "Start Debate"

### 2. Select Topic
Choose from suggested or enter custom

### 3. Choose Position
Select Pro or Con

### 4. Select AI Opponent
Available personalities:
- Academic Alex
- Emotional Emma
- Socratic Sam
- Political Pat
- Creative Casey
- 5 additional personalities

### 5. Debate Format
Public Forum structure:
1. Opening Statements - 3 minutes each
2. Crossfire - 3 minutes
3. Rebuttal - 2 minutes each
4. Final Focus - 1 minute each

### 6. Review Performance
Post-debate displays:
- Performance score
- AI feedback
- Improvement suggestions
- Debate history

## Speech Analysis

### Record Speech
1. Navigate to "Speech Feedback"
2. Click "Start Recording"
3. Speak 30 seconds to 3 minutes
4. Click "Stop"

### Upload Speech
1. Click "Upload Audio"
2. Select file (MP3, WAV, M4A)
3. Wait for processing

### Analysis Results
- Delivery metrics
- Argument structure
- Persuasiveness score
- Overall rating

## Evidence Search

### Basic Search
1. Go to "Search Evidence"
2. Enter query
3. View results

### RAG Search
1. Toggle "Enhanced RAG"
2. Searches through:
   - Uploaded PDFs
   - Wiki articles
   - OpenCaseList database

### View Context
1. Click "View Context"
2. See surrounding paragraphs
3. Open source PDF

### Save Evidence
1. Click star icon
2. Access in "My Research"
3. Organize by topic

## Development Commands
```bash
# Check setup
npm run check-env

# Lint code
npm run lint

# Type check
npm run typecheck

# Production build
npm run build

# Test emails
npm run preview-email confirm-signup

# Test WebSocket
npm run test:socket

# Manual tests
npm run test:manual
```

## Troubleshooting

### Debate Won't Start
1. Check browser console
2. Grant microphone permissions
3. Refresh page
4. Clear browser cache

### Audio Issues
- Use Chrome/Edge
- Allow microphone access
- Test system microphone
- Check ElevenLabs quota (10k chars/month free)

### Search No Results
- Try different keywords
- Use "Enhanced RAG" mode
- Verify OpenAI API key valid

## File Locations
Dashboard: http://localhost:3001
API health: http://localhost:3001/api/health
Browser console: F12 → Console tab
Logs: Browser console and terminal output