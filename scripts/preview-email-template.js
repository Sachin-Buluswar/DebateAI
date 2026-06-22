#!/usr/bin/env node

/**
 * Preview email templates in browser
 * Usage: npm run preview-email [template-name]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const templateDir = path.join(__dirname, '..', 'src', 'email-templates');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('\n🖼️  Preview Email Templates:\n');
  console.log('  • confirm-signup   - Email verification for new signups');
  console.log('  • reset-password   - Password reset requests');
  console.log('  • magic-link       - Passwordless login links');
  console.log('  • change-email     - Email address change confirmation');
  console.log('  • welcome          - Welcome email after signup\n');
  console.log('Usage: npm run preview-email [template-name]');
  console.log('Example: npm run preview-email confirm-signup\n');
  process.exit(0);
}

const templateName = args[0];
const templateFile = path.join(templateDir, `${templateName}.html`);

if (!fs.existsSync(templateFile)) {
  console.error(`❌ Template "${templateName}" not found!`);
  console.log(
    '\nAvailable templates: confirm-signup, reset-password, magic-link, change-email, welcome\n'
  );
  process.exit(1);
}

// Read template and replace variables with sample data
let content = fs.readFileSync(templateFile, 'utf8');

// Replace template variables with sample data
content = content
  .replace(
    /\{\{ \.ConfirmationURL \}\}/g,
    'https://your-site.com/auth/confirm?token=sample-token-123'
  )
  .replace(/\{\{ \.Email \}\}/g, 'user@example.com')
  .replace(/\{\{ \.SiteURL \}\}/g, 'https://your-site.com');

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(content);
});

const port = 8080;
server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`\n✨ Email template preview server running at: ${url}`);
  console.log('\n📧 Previewing:', templateName);
  console.log('\nPress Ctrl+C to stop the server\n');

  // Open browser
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync(`open ${url}`);
    } else if (platform === 'linux') {
      execSync(`xdg-open ${url}`);
    } else if (platform === 'win32') {
      execSync(`start ${url}`);
    }
  } catch (e) {
    console.log(`Open ${url} in your browser to preview the template`);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down preview server...');
  server.close();
  process.exit(0);
});
