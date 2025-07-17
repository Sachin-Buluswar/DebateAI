# Quick Start Guide

Get up and running with DebateAI in minutes! This guide assumes you've completed the [installation](./installation.md) and [configuration](./configuration.md) steps.

## 🚀 Start the Application

```bash
npm run dev
```

Open your browser to: **http://localhost:3001**

## 🔐 Create Your Account

### 1. Sign Up

1. Click "Sign Up" on the homepage
2. Enter your email and password
3. Check your email for the confirmation link
4. Click the link to verify your account

### 2. Sign In

Once verified:
1. Return to the login page
2. Enter your credentials
3. You'll be redirected to your dashboard

## 🎯 Your First Debate

### Step 1: Choose Your Topic

1. Click "Start Debate" from the dashboard
2. Select a debate topic:
   - **Suggested topics** are provided
   - Or enter a **custom topic**
3. Choose your position (Pro or Con)

### Step 2: Select AI Opponents

Choose from 10 unique personalities:

- **Academic Alex** - Logical, evidence-based
- **Emotional Emma** - Passionate, persuasive
- **Socratic Sam** - Questions everything
- **Political Pat** - Policy-focused
- **Creative Casey** - Think outside the box
- And 5 more distinct styles!

### Step 3: Start Debating

The debate follows Public Forum format:

1. **Opening Statements** (3 minutes each)
   - Present your main arguments
   - AI opponent goes first

2. **Crossfire** (3 minutes)
   - Q&A with your opponent
   - Stay sharp and think fast!

3. **Rebuttal** (2 minutes each)
   - Counter opponent's arguments
   - Strengthen your position

4. **Final Focus** (1 minute each)
   - Summarize key points
   - Make your closing appeal

### Step 4: Review Your Performance

After the debate:
- View your **performance score**
- Read **AI feedback** on your arguments
- See **improvement suggestions**
- Track your **debate history**

## 🎙️ Speech Analysis

### Record a Speech

1. Navigate to "Speech Feedback"
2. Click "Start Recording"
3. Speak for 30 seconds to 3 minutes
4. Click "Stop" when finished

### Upload a Speech

1. Click "Upload Audio"
2. Select your file (MP3, WAV, M4A)
3. Wait for processing

### Review Feedback

Get detailed analysis on:
- **Delivery** - Pace, clarity, confidence
- **Arguments** - Logic, evidence, structure  
- **Persuasiveness** - Emotional appeal, credibility
- **Overall Score** - Combined metrics

## 🔍 Evidence Search

### Basic Search

1. Go to "Search Evidence"
2. Enter your search query
3. View results from multiple sources

### Advanced RAG Search

1. Toggle "Enhanced RAG" mode
2. Search semantically through:
   - Uploaded PDFs
   - Wiki articles
   - OpenCaseList database

### View Context

For any result:
1. Click "View Context"
2. See surrounding paragraphs
3. Open source PDF directly

### Save Evidence

1. Click star icon to save
2. Access saved evidence in "My Research"
3. Organize by debate topic

## 💡 Pro Tips

### Debate Strategy

- **Prepare opening statements** before starting
- **Take notes** during opponent speeches
- **Use evidence** from your research
- **Practice crossfire** questions

### Speech Improvement

- **Record multiple takes** to see progress
- **Focus on one aspect** at a time
- **Review AI feedback** carefully
- **Set improvement goals**

### Research Tips

- **Use specific keywords** for better results
- **Save evidence** as you find it
- **Read full context** before using
- **Cite your sources** in debates

## 🛠️ Useful Commands

### Development Scripts

```bash
# Check your setup
npm run check-env

# Run linting
npm run lint

# Type checking
npm run typecheck

# Build for production
npm run build
```

### Testing Features

```bash
# Test email templates
npm run preview-email confirm-signup

# Test Socket.IO connection
npm run test:socket

# Manual API tests
npm run test:manual
```

## 🐛 Troubleshooting

### Can't Start Debate?

1. Check browser console for errors
2. Ensure microphone permissions are granted
3. Try refreshing the page
4. Clear browser cache

### Audio Not Working?

1. **Check browser compatibility** - Chrome/Edge work best
2. **Allow microphone access** when prompted
3. **Test microphone** in system settings
4. **Check ElevenLabs quota** (10k chars/month free)

### Search Not Finding Results?

1. Try different keywords
2. Use "Enhanced RAG" mode
3. Check if PDFs are properly indexed
4. Verify OpenAI API key is valid

## 📚 Next Steps

Now that you're up and running:

1. **Explore all features** - Try each section
2. **Practice regularly** - Improve your skills
3. **Track progress** - Review your history
4. **Join debates** - Challenge yourself with harder topics

### Learn More

- [AI Opponents Guide](../features/ai-opponents.md) - Detailed personality profiles
- [Debate Formats](../features/debate-formats.md) - Understanding Public Forum
- [Architecture Overview](../architecture.md) - How it all works
- [API Documentation](../apis/) - Technical details

## 🎉 Congratulations!

You're now ready to master the art of debate with DebateAI. Remember:

- **Practice makes perfect** - Debate regularly
- **Learn from feedback** - AI insights are valuable
- **Build your research** - Strong evidence wins debates
- **Have fun!** - Enjoy the learning process

Happy debating! 🎯