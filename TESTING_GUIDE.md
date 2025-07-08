# Testing & Approval Guide

## 🎯 **How to Test Changes Before They Go Live**

### **Quick Commands**

```bash
# See what branch you're on
git branch

# Switch to main (your live version)
git checkout main
npm run dev  # Test at http://localhost:3001

# Switch to test version
git checkout [branch-name]
npm run dev  # Test new changes at http://localhost:3001

# If you APPROVE changes
git checkout main
git merge [branch-name]
git push origin main

# If you REJECT changes
git checkout main
git branch -D [branch-name]  # Deletes the test branch
```

## 📋 **Testing Checklist**

### **For ANY Change**
- [ ] Website loads without errors
- [ ] All buttons and links work
- [ ] Dark/Light mode toggle works
- [ ] Mobile view looks good
- [ ] Core features still work:
  - [ ] Debate simulator (/debate)
  - [ ] Speech feedback (/speech-feedback)  
  - [ ] Wiki search (/search)
  - [ ] Authentication (/auth)

### **For UI Changes Specifically**
- [ ] Does it look better than before?
- [ ] Is it easy to navigate?
- [ ] Is text readable?
- [ ] Do colors make sense?
- [ ] Does it feel professional?

## 🔄 **Approval Process**

### **Technical Updates**
1. Claude creates `tech-updates` branch
2. You test both versions side by side
3. You decide: Approve ✅ or Reject ❌

### **UI Redesigns**
1. Claude creates `ui-redesign` branch
2. You test new design extensively
3. You compare with old design
4. You decide: Keep new ✅ or Revert to old ❌

## 🆘 **Emergency: "I Broke Something!"**

```bash
# Go back to last working version
git checkout main
git reset --hard HEAD~1
git push origin main --force
```

## 📞 **When to Ask Claude for Help**

- If commands don't work
- If website won't start
- If you're unsure about a change
- If you want to see specific comparisons

Remember: **Nothing goes live until YOU approve it!**