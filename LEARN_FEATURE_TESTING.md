# Learn Feature Testing Checklist

## Navigation Testing

### Desktop Navigation
- [ ] Learn link appears in top navigation bar
- [ ] Learn link is styled correctly (sage green on hover)
- [ ] Learn link navigates to /learn
- [ ] Active state shows when on learn pages

### Mobile Navigation (Not Logged In)
- [ ] Open hamburger menu on mobile
- [ ] Learn link appears in mobile menu
- [ ] Learn link navigates correctly
- [ ] Menu closes after clicking learn

### Sidebar Navigation (Logged In)
- [ ] Learn link appears in sidebar (between search and feedback)
- [ ] Short name "l" appears when sidebar is collapsed
- [ ] Full name "learn" appears when sidebar is expanded
- [ ] Learn link is highlighted when active
- [ ] Navigation works from sidebar

## Resource Display Testing

### Learn Page
- [ ] Resources load and display correctly
- [ ] Featured resources show at top
- [ ] Category filters work
- [ ] Difficulty filters work
- [ ] View/download counts display
- [ ] Author names display correctly
- [ ] No authentication required to view

### Resource Viewer Page
- [ ] PDF viewer loads (will show blocked on localhost, OK on production)
- [ ] Download button works
- [ ] Share button works
- [ ] View count increments on page load
- [ ] Download count increments on download
- [ ] Back button returns to learn page
- [ ] Metadata displays correctly

## Analytics Testing

### View Tracking
- [ ] View count increases when resource is viewed
- [ ] Count persists across page refreshes
- [ ] Count is visible to all users
- [ ] Anonymous tracking works (no login required)

### Download Tracking
- [ ] Download count increases on download
- [ ] Count persists across sessions
- [ ] Download actually downloads the PDF
- [ ] Count updates immediately

### Share Tracking
- [ ] Share button triggers share dialog (if supported)
- [ ] Share event is tracked in analytics
- [ ] Fallback copy-to-clipboard works

## Database Verification

Run these queries in Supabase to verify:

```sql
-- Check resource counts
SELECT title, view_count, download_count 
FROM educational_resources;

-- Check analytics records
SELECT event_type, COUNT(*) 
FROM resource_analytics 
GROUP BY event_type;

-- Verify trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'update_resource_counts_trigger';
```

## Common Issues & Solutions

### Issue: View/Download counts not updating
**Solution**: Run the trigger fix script from `/src/backend/migrations/fix_resource_counts_trigger.sql`

### Issue: Learn link missing from sidebar
**Solution**: Clear cache and hard refresh (Cmd+Shift+R)

### Issue: "Content blocked" message in PDF viewer
**Expected on localhost** - Will work on production domain

### Issue: Resources not loading
**Check**: 
1. Database tables exist
2. Initial resource was inserted
3. API endpoint is accessible

## Production Readiness

- [x] Public access without authentication
- [x] Navigation integrated in all menus
- [x] View/download tracking working
- [x] Mobile responsive design
- [x] Error handling in place
- [x] Loading states implemented
- [x] Graceful degradation for missing data
- [x] PDF viewer fallback to download
- [x] Analytics tracking functional

## Testing Commands

```bash
# Check if learn appears in navigation
curl -s http://localhost:3001 | grep -c "learn"

# Check API response
curl -s http://localhost:3001/api/resources | jq '.resources | length'

# Check specific resource
curl -s http://localhost:3001/api/resources/intro-to-public-forum | jq '.resource.title'

# Test tracking endpoint
curl -X POST http://localhost:3001/api/resources/track \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"537e0d00-dfa1-4d8c-9ae0-16f214f97ad9","eventType":"view","sessionId":"test123"}'
```