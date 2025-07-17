# Contributing to DebateAI

Thank you for your interest in contributing to DebateAI! This guide will help you get started with contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- **Be respectful** - Treat everyone with respect. No harassment, discrimination, or inappropriate behavior.
- **Be collaborative** - Work together to resolve conflicts and assume good intentions.
- **Be inclusive** - Welcome and support people of all backgrounds and identities.
- **Be professional** - Maintain a professional atmosphere in all project spaces.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/debateai.git
   cd debateai
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/debateai.git
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 💻 Development Setup

See our [Development Setup Guide](docs/development/setup.md) for detailed instructions. Quick start:

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your environment (see docs/getting-started/configuration.md)
# Add your API keys to .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## 🤝 How to Contribute

### Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, browser, Node version)

### Suggesting Features

1. **Check the roadmap** in [docs/project/roadmap.md](docs/project/roadmap.md)
2. **Create a feature request** with:
   - Clear use case
   - Proposed solution
   - Alternative solutions considered
   - Mockups or examples if applicable

### Contributing Code

1. **Pick an issue** labeled `good first issue` or `help wanted`
2. **Comment on the issue** to claim it
3. **Follow the development workflow** in [docs/development/workflow.md](docs/development/workflow.md)
4. **Write tests** for your changes
5. **Update documentation** if needed

## 🔄 Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   npm run lint        # Fix any linting errors
   npm run typecheck   # Ensure TypeScript types are correct
   npm run test        # Run all tests
   ```

3. **Test your changes**:
   - Test all affected features
   - Test on mobile devices
   - Check for console errors
   - Verify API responses

### PR Guidelines

1. **Title**: Use conventional commit format
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes
   - `refactor:` Code refactoring
   - `test:` Test changes
   - `chore:` Build/tool changes

2. **Description**: Include:
   - What changes were made
   - Why these changes were made
   - Related issue numbers
   - Screenshots for UI changes
   - Breaking changes if any

3. **Size**: Keep PRs small and focused
   - One feature/fix per PR
   - Split large changes into multiple PRs

### Review Process

1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Testing** on staging environment
4. **Approval** from at least one maintainer
5. **Merge** by maintainers only

## 📝 Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow existing code patterns (see [docs/development/patterns.md](docs/development/patterns.md))
- Use meaningful variable names
- Add JSDoc comments for complex functions
- Prefer functional components for React
- Use server components by default

### Style Guide

```typescript
// Good
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) throw new AppError('User not found', 404);
  return data;
}

// Bad
export async function getUser(id) {
  const res = await supabase.from('profiles').select('*').eq('id', id).single();
  return res.data;
}
```

### Git Commit Messages

```
feat: add user profile editing

- Add profile edit form component
- Implement profile update API endpoint
- Add validation for profile fields
- Update UI to show edit button

Closes #123
```

## 🧪 Testing Guidelines

- Write tests for all new features
- Maintain test coverage above 80%
- Use descriptive test names
- Test edge cases and error scenarios

```typescript
describe('UserProfile', () => {
  it('should display user information correctly', () => {
    // Test implementation
  });
  
  it('should handle loading state', () => {
    // Test implementation
  });
  
  it('should show error message on fetch failure', () => {
    // Test implementation
  });
});
```

## 📚 Documentation

### When to Update Docs

- Adding new features
- Changing existing behavior
- Adding new dependencies
- Modifying setup process
- Changing API endpoints

### Documentation Standards

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep formatting consistent
- Update the table of contents

### Where to Document

- **API changes**: Update [docs/api/](docs/api/)
- **New features**: Update relevant guides
- **Setup changes**: Update [docs/getting-started/](docs/getting-started/)
- **Architecture changes**: Update [docs/architecture/](docs/architecture/)

## 👥 Community

- **Discord**: Join our Discord server for discussions
- **GitHub Discussions**: For feature requests and questions
- **Twitter**: Follow @DebateAI for updates

## 🙏 Recognition

Contributors will be:
- Listed in our CONTRIBUTORS.md file
- Mentioned in release notes
- Given credit in commit messages

## ❓ Questions?

- Check our [FAQ](docs/FAQ.md)
- Read the [documentation](docs/README.md)
- Ask in GitHub Discussions
- Contact maintainers

---

Thank you for contributing to DebateAI! Your efforts help make AI-powered debate practice accessible to everyone. 🎯