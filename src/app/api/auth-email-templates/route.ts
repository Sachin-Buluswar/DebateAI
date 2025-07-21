import { NextResponse } from 'next/server';

// These templates will be used in Supabase dashboard settings for authentication emails
// Export these templates and paste them in the Supabase dashboard

export async function GET() {
  const emailConfirmationTemplate = `
<h2>Welcome to Atlas Debate!</h2>
<p>Thanks for signing up. We're excited to help you improve your debate skills.</p>
<p>Please confirm your email by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
<p>This link will expire in 24 hours.</p>
<p>If you didn't register for Atlas Debate, you can safely ignore this email.</p>
<p>Happy debating!<br>The Atlas Team</p>
`;

  const inviteUserTemplate = `
<h2>You've been invited to join Atlas Debate</h2>
<p>You've been invited to create a user on Atlas Debate, the AI-powered platform for debate training.</p>
<p>Click the link below to accept the invite:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
<p>The link will expire in 24 hours.</p>
<p>If you have any questions, feel free to reach out to our support team.</p>
<p>Best regards,<br>The Atlas Team</p>
`;

  const magicLinkTemplate = `
<h2>Magic Link for Atlas Debate</h2>
<p>Click the link below to sign in to your Atlas Debate account:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In</a></p>
<p>If you didn't request this link, you can safely ignore this email.</p>
<p>This link will expire in 10 minutes and can only be used once.</p>
<p>Happy debating!<br>The Atlas Team</p>
`;

  const resetPasswordTemplate = `
<h2>Reset Your Atlas Debate Password</h2>
<p>You have requested to reset your password on Atlas Debate.</p>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>The link will expire in 24 hours.</p>
<p>If you didn't request this password reset, please ignore this email or contact support if you're concerned.</p>
<p>Best regards,<br>The Atlas Team</p>
`;

  const changeEmailTemplate = `
<h2>Confirm Email Change for Atlas Debate</h2>
<p>You have requested to update your email address on Atlas Debate.</p>
<p>Click the link below to confirm the change to: {{ .NewEmail }}</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email Change</a></p>
<p>The link will expire in 24 hours.</p>
<p>If you didn't request this change, please contact support immediately.</p>
<p>Best regards,<br>The Atlas Team</p>
`;

  // Return all templates in a structured JSON format
  return NextResponse.json({
    emailConfirmationTemplate,
    inviteUserTemplate,
    magicLinkTemplate,
    resetPasswordTemplate,
    changeEmailTemplate,
    message: "Copy these templates and use them in your Supabase dashboard Email Templates settings"
  });
} 