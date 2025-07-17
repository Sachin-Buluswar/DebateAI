# 📧 DebateAI Email Templates

Beautiful, minimalist email templates that match your site's design aesthetic.

## 🚀 Quick Start

### **1. Preview Templates**
```bash
# Preview any template in your browser
npm run preview-email confirm-signup
npm run preview-email reset-password
npm run preview-email magic-link
npm run preview-email change-email
npm run preview-email welcome
```

### **2. Copy to Clipboard**
```bash
# Copy template HTML to clipboard for Supabase
npm run copy-email confirm-signup
# Then paste into Supabase Dashboard → Authentication → Email Templates
```

### **3. Configure in Supabase**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Email Templates**
3. Enable "Custom email" for each template
4. Paste the template content
5. Save changes

## 📋 Template Overview

| Template | Purpose | When Sent |
|----------|---------|-----------|
| `confirm-signup.html` | Email verification | After user signs up |
| `reset-password.html` | Password reset link | When user requests password reset |
| `magic-link.html` | Passwordless login | For magic link authentication |
| `change-email.html` | Email change confirmation | When user changes email |
| `welcome.html` | Welcome message | After successful verification (optional) |

## 🎨 Design Features

- **Minimalist aesthetic** matching your site
- **Sage green accent** (#87A96B) for brand consistency
- **Mobile responsive** design
- **Clean typography** with Inter font
- **No rounded corners** following your design system
- **Subtle animations** and hover states
- **Dark mode friendly** color choices

## 📝 Full Setup Guide

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed configuration instructions.

## ✅ Next Steps

1. **Preview** each template to ensure they look correct
2. **Copy** templates to Supabase using the helper scripts
3. **Test** each email type in your development environment
4. **Configure SMTP** for better deliverability (optional but recommended)

Need help? Check the setup guide or test with `npm run preview-email`!