# 📧 Email Template Setup Checklist

## 🚨 **USER ACTION REQUIRED**

Since there's no Supabase MCP integration available, you'll need to manually configure the email templates. I've created tools to make this as easy as possible.

## 🚀 **Quick Setup (Recommended)**

Run the interactive setup assistant:

```bash
npm run setup-emails
```

This will guide you through each template step-by-step, copying them to your clipboard at the right time.

## 📋 **Manual Setup Steps**

If you prefer to do it manually:

### 1️⃣ **Configure Each Email Template**

For each template type:

```bash
# Copy template to clipboard
npm run copy-email confirm-signup

# Then in Supabase Dashboard:
# 1. Go to Authentication → Email Templates
# 2. Select "Confirm signup" 
# 3. Enable "Custom email"
# 4. Paste (Cmd/Ctrl + V)
# 5. Save
```

Repeat for:
- `reset-password`
- `magic-link` 
- `change-email`

### 2️⃣ **Configure Email Settings**

In Supabase Dashboard → Authentication → Email Settings:

- [ ] **Sender Email**: Set to `noreply@yourdomain.com` (or your domain email)
- [ ] **Sender Name**: Set to "DebateAI"
- [ ] **Reply-To Email**: Your support email (optional)

### 3️⃣ **Optional: Configure Custom SMTP**

For better deliverability (recommended for production):

1. Go to Project Settings → Authentication → SMTP Settings
2. Enable "Custom SMTP"
3. Configure with your provider (SendGrid, Mailgun, etc.)

## ✅ **Verification Checklist**

After setup, test each email:

- [ ] **Signup**: Create test account → Verify confirmation email
- [ ] **Password Reset**: Click "Forgot Password" → Verify reset email  
- [ ] **Magic Link**: If enabled, test passwordless login
- [ ] **Email Change**: Change email in settings → Verify change email

## 🎨 **What You Get**

All emails will now feature:
- Your minimalist design aesthetic
- Sage green (#87A96B) brand colors
- Clean typography with Inter font
- Mobile-responsive layouts
- No rounded corners (sharp, modern design)
- Consistent spacing and styling

## 📚 **Resources**

- **Preview any template**: `npm run preview-email [template-name]`
- **Full setup guide**: `src/email-templates/SETUP_GUIDE.md`
- **Template files**: `src/email-templates/`

## ⏱️ **Time Required**

- Using interactive assistant: ~5-10 minutes
- Manual setup: ~10-15 minutes
- Testing: ~5 minutes

Your users will love receiving these beautifully designed emails that match your site's aesthetic!