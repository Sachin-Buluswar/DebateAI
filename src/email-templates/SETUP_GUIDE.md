# Email Template Setup Guide for Eris Debate

## 🎨 **Custom Email Templates - Minimalist Design**

Your Eris Debate email templates have been designed to match your site's minimalist aesthetic. These templates replace the generic Supabase emails with beautifully branded communications.

## 📋 **Available Templates**

1. **confirm-signup.html** - Email verification for new signups
2. **reset-password.html** - Password reset requests
3. **magic-link.html** - Passwordless login links
4. **change-email.html** - Email address change confirmation
5. **welcome.html** - Welcome email after successful signup (optional)

## 🚀 **Setup Instructions**

### **Step 1: Access Supabase Dashboard**

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your Eris Debate project
3. Navigate to **Authentication** → **Email Templates**

### **Step 2: Configure Each Template**

For each email type, you'll need to:

1. **Enable Custom Template**
   - Toggle "Enable custom email" to ON
   
2. **Copy Template Content**
   - Open the corresponding `.html` file from `src/email-templates/`
   - Copy the entire HTML content
   - Paste into the Supabase template editor

3. **Configure Subject Lines**
   - **Confirm signup**: "Confirm your Eris Debate account"
   - **Reset password**: "Reset your Eris Debate password"
   - **Magic link**: "Your Eris Debate login link"
   - **Change email**: "Confirm your new email address"

### **Step 3: Template Variables**

Supabase uses these variables in templates:
- `{{ .ConfirmationURL }}` - The action link
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL

These are already included in the templates.

### **Step 4: Email Settings**

In **Authentication** → **Email Settings**:

1. **Sender Email**: Set a professional email like `noreply@yourdomain.com`
2. **Sender Name**: "Eris Debate"
3. **Reply-To**: Your support email

### **Step 5: SMTP Configuration (Recommended)**

For better deliverability, configure custom SMTP:

1. Go to **Project Settings** → **Authentication**
2. Under **SMTP Settings**, enable "Custom SMTP"
3. Configure with your email service (SendGrid, Mailgun, etc.):
   ```
   Host: smtp.sendgrid.net (example)
   Port: 587
   Username: apikey
   Password: [your-api-key]
   ```

## 🧪 **Testing Your Templates**

### **Test Each Email Type:**

1. **Signup Confirmation**
   ```bash
   # Create a test account on your site
   # Check the confirmation email
   ```

2. **Password Reset**
   ```bash
   # Click "Forgot Password" on login
   # Enter test email
   # Check reset email
   ```

3. **Magic Link** (if enabled)
   ```bash
   # Use passwordless login option
   # Enter email
   # Check magic link email
   ```

## 🎨 **Design System**

All emails follow your minimalist design principles:

- **Colors**
  - Primary: #87A96B (sage green)
  - Text: #171717 (dark) / #525252 (muted)
  - Background: #ffffff / #fafafa
  - Borders: #e5e5e5

- **Typography**
  - Font: Inter (with fallbacks)
  - Headers: 300-400 weight
  - Body: 16px, line-height 24px
  - Lowercase for CTAs and headers

- **Styling**
  - No rounded corners
  - Minimal shadows
  - 1-2px borders
  - Clean, spacious layout
  - Mobile-responsive

## 📱 **Mobile Optimization**

All templates are mobile-optimized with:
- Responsive tables
- Readable font sizes
- Touch-friendly buttons
- Proper spacing

## ⚠️ **Important Notes**

1. **Email Deliverability**
   - Use a proper domain email (not @gmail.com)
   - Configure SPF/DKIM records
   - Monitor spam scores

2. **Testing**
   - Always test in multiple email clients
   - Check both light and dark modes
   - Verify all links work correctly

3. **Customization**
   - Feel free to adjust copy to match your tone
   - Keep design consistent with site
   - Maintain accessibility standards

## 🔧 **Troubleshooting**

**Templates not showing?**
- Ensure "Enable custom email" is ON
- Check for HTML syntax errors
- Verify template variables are correct

**Emails going to spam?**
- Configure custom SMTP
- Add SPF/DKIM records
- Use a reputable email service

**Links not working?**
- Check Redirect URLs in Auth settings
- Ensure site URL is configured correctly
- Verify email confirmation settings

## 📞 **Need Help?**

If you encounter any issues:
1. Check Supabase logs for email errors
2. Test with different email providers
3. Verify all Auth settings are correct

Remember to maintain consistency across all user touchpoints - from the first email to the final debate analysis!