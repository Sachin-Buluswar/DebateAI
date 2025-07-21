# Git Workflow and Branching Strategy

This guide outlines the Git workflow and branching strategy for the Eris Debate project.

## Branch Strategy

### Main Branches

- **`main`** - Production-ready code. Protected branch requiring pull requests and approval.
- **`ui-improvements`** - Active UI/UX enhancements branch (current focus)

### Feature Branches

- **`feature/*`** - New feature development
- **`fix/*`** - Bug fixes
- **`hotfix/*`** - Critical production fixes
- **`chore/*`** - Maintenance tasks (dependencies, configs, etc.)

### Branch Naming Conventions

```bash
feature/add-debate-timer
fix/audio-playback-issue
hotfix/auth-token-expiry
chore/update-dependencies
```

## Development Process

### 1. Starting New Work

Always create a feature branch from the latest main:

```bash
# Ensure you have the latest main
git checkout main
git pull origin main

# Create and checkout new branch
git checkout -b feature/your-feature-name
```

### 2. Development Workflow

```bash
# Make your changes
# ... edit files ...

# Check your changes
git status
git diff

# Stage and commit with descriptive message
git add .
git commit -m "feat: add debate timer with pause functionality"
```

### 3. Commit Message Format

Follow conventional commits for clear history:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```bash
git commit -m "feat(debate): add AI personality selection"
git commit -m "fix(audio): resolve playback stuttering on Safari"
git commit -m "docs: update API documentation for v2 endpoints"
```

### 4. Testing Before Push

**Always test before pushing:**

```bash
# Run linting
npm run lint

# Run TypeScript checks
npm run typecheck

# Run manual tests
npm run test:manual

# Start dev server and manually test your changes
npm run dev
```

### 5. Pushing Changes

```bash
# Push your branch
git push origin feature/your-feature-name
```

## Code Review Process

### 1. Create Pull Request

- Use GitHub's PR template
- Provide clear description of changes
- Link any related issues
- Add screenshots for UI changes

### 2. PR Checklist

Before requesting review, ensure:

- [ ] All tests pass
- [ ] No linting errors
- [ ] TypeScript compilation succeeds
- [ ] Manual testing completed
- [ ] Documentation updated if needed
- [ ] No console.log statements left
- [ ] Environment variables documented

### 3. Review Guidelines

Reviewers should check:

- Code follows project patterns
- Error handling is comprehensive
- Security best practices followed
- Performance implications considered
- Mobile compatibility maintained

## Merging Protocol

### IMPORTANT: User Approval Required

**Claude/AI assistants should NEVER merge without explicit user approval**

### For Testing Changes

```bash
# User tests the branch locally
git checkout feature/branch-name
npm install  # If dependencies changed
npm run dev

# User reviews changes in browser
```

### For Merging (User Only)

```bash
# After approval, user merges
git checkout main
git pull origin main
git merge feature/branch-name
git push origin main

# Delete feature branch
git branch -d feature/branch-name
git push origin --delete feature/branch-name
```

## Handling Conflicts

### 1. Update Your Branch

```bash
# From your feature branch
git checkout feature/your-branch
git fetch origin
git rebase origin/main
```

### 2. Resolve Conflicts

```bash
# Fix conflicts in your editor
# Look for <<<<<<< HEAD markers

# After resolving
git add .
git rebase --continue
```

### 3. Force Push After Rebase

```bash
git push origin feature/your-branch --force-with-lease
```

## Release Process

### 1. Version Tagging

```bash
# Create annotated tag
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0
```

### 2. Release Notes

Include in release:
- New features
- Bug fixes
- Breaking changes
- Migration instructions

## Emergency Hotfix Process

For critical production issues:

```bash
# Create hotfix from main
git checkout main
git checkout -b hotfix/critical-auth-fix

# Make minimal fix
# ... fix code ...

# Fast-track testing
npm run test:critical

# Push for immediate review
git push origin hotfix/critical-auth-fix
```

## Best Practices

### 1. Keep Branches Small

- Focus on single feature/fix
- Easier to review
- Reduces merge conflicts

### 2. Regular Updates

```bash
# Regularly sync with main
git fetch origin
git rebase origin/main
```

### 3. Clean History

```bash
# Before pushing, clean up commits
git rebase -i HEAD~3
```

### 4. Branch Hygiene

```bash
# List all branches
git branch -a

# Delete merged local branches
git branch --merged | grep -v main | xargs -n 1 git branch -d

# Prune remote branches
git remote prune origin
```

## Git Aliases (Optional)

Add to `~/.gitconfig`:

```ini
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    unstage = reset HEAD --
    last = log -1 HEAD
    visual = !gitk
    update = !git fetch origin && git rebase origin/main
```

## Troubleshooting

### Accidental Commit to Main

```bash
# Create branch from current state
git branch feature/accidental-work

# Reset main to origin
git reset --hard origin/main

# Switch to feature branch
git checkout feature/accidental-work
```

### Lost Changes

```bash
# Check reflog
git reflog

# Restore from reflog
git checkout HEAD@{2}
```

### Large Files

Use Git LFS for large files:

```bash
git lfs track "*.pdf"
git add .gitattributes
```

## CI/CD Integration

All branches automatically:
- Run tests on push
- Check code quality
- Build Docker images
- Deploy previews for PRs

See [CI/CD Setup](../CI_CD_SETUP.md) for details.

## Summary

1. **Always branch** from main
2. **Test thoroughly** before pushing
3. **Get approval** before merging
4. **Keep commits clean** and descriptive
5. **Update regularly** from main

Remember: This is a production application. Quality and stability are paramount!