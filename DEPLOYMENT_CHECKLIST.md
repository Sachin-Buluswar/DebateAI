# Eris Debate - Deployment Checklist

## ✅ Completed Fixes

### 1. Branding Update
- [x] Changed all references from previous names to "Eris Debate"
- [x] Updated domain references to use production domain
- [x] Updated package.json, UI components, email templates

### 2. Socket.IO / Real-time Features
- [x] Fixed WebSocket errors on Vercel
- [x] Configured polling-only transport for Vercel
- [x] Added fallback mechanisms
- [x] Created user-friendly warnings

### 3. Documentation
- [x] Created Vercel Socket.IO guide
- [x] Added deployment fix summary
- [x] Updated troubleshooting guides

## 🧪 Features to Test

### 1. Authentication (`/auth`)
- [ ] Sign up with email
- [ ] Sign in with email
- [ ] Magic link login
- [ ] Password reset
- [ ] Session persistence

### 2. Real-time Debates (`/debate`)
- [ ] Create new debate
- [ ] Select AI debaters
- [ ] Start debate session
- [ ] Audio recording/playback
- [ ] Turn management
- [ ] Evidence search panel
- [ ] Debate completion

### 3. Speech Analysis (`/speech-feedback`)
- [ ] Upload audio file
- [ ] Record speech
- [ ] Receive AI feedback
- [ ] View analysis results
- [ ] Save feedback history

### 4. Evidence Search (`/search`)
- [ ] Search functionality
- [ ] RAG-based results
- [ ] Document viewing
- [ ] Context highlighting

### 5. Admin Features (`/admin`)
- [ ] Document management
- [ ] User management (if implemented)
- [ ] System monitoring

## 🔧 Vercel Configuration

### Required Environment Variables
```
NEXT_PUBLIC_VERCEL=1
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_VECTOR_STORE_ID=
NEXT_PUBLIC_SITE_URL=https://erisdebate.com
```

### Optional but Recommended
```
DEBUG_API_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_NAME=Eris Debate
ALLOWED_ORIGINS=https://erisdebate.com,https://www.erisdebate.com
```

## 🚀 Deployment Steps

1. **Set Environment Variables**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add all required variables

2. **Deploy**
   ```bash
   git push origin main
   ```
   Vercel will auto-deploy

3. **Verify Deployment**
   - Check https://erisdebate.com/api/health
   - Test each feature in the checklist above
   - Monitor browser console for errors

## 🐛 Common Issues & Solutions

### Issue: "Failed to connect to debate server"
**Solution**: Clear cache, check Socket.IO is using polling mode

### Issue: "Authentication failed"
**Solution**: Verify Supabase keys are correctly set in Vercel

### Issue: "OpenAI API error"
**Solution**: Check OPENAI_API_KEY is set and has credits

### Issue: "Audio features not working"
**Solution**: Verify ELEVENLABS_API_KEY is set

## 📊 Monitoring

### Health Checks
- `/api/health` - Basic health status
- `/api/socket-init` - Socket.IO configuration
- `/api/debug?key=YOUR_KEY` - Detailed diagnostics (if DEBUG_API_KEY is set)

### Logs
- Check Vercel Function logs for server errors
- Browser console for client-side errors
- Network tab for API failures

## 🎯 Success Criteria

- [ ] All pages load without errors
- [ ] Authentication flow works
- [ ] Can create and participate in debates
- [ ] Speech analysis provides feedback
- [ ] Search returns relevant results
- [ ] No console errors in production
- [ ] Mobile responsive (basic functionality)

## 📞 Support

If issues persist after following this checklist:
1. Check `/api/debug` endpoint
2. Review Vercel function logs
3. Check browser console for detailed errors
4. Review Socket.IO fallback warnings

---

Last updated: [Current Date]
Status: Ready for production deployment with known Vercel limitations