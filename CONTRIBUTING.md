# Contributing

## Setup

```bash
git clone https://github.com/ORIGINAL_OWNER/debateai.git
cd debateai
npm install
cp .env.example .env.local
# Add API keys to .env.local
```

## Workflow

### 1. Create Branch
```bash
git checkout -b feature/description
```

### 2. Make Changes
Follow patterns in `CLAUDE.md`

### 3. Test
```bash
npm run lint
npm run typecheck
npm run build
```

### 4. Commit
```bash
git add .
git commit -m "type: description

- Detail 1
- Detail 2"
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### 5. Push
```bash
git push origin feature/description
```

## Code Standards

### File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- API routes: `route.ts`

### Imports
```typescript
// External
import { useState } from 'react';

// Internal
import { Component } from '@/components';

// Types
import type { ComponentProps } from '@/types';
```

### Error Handling
```typescript
try {
  // Action
} catch (error) {
  console.error('Context:', error);
  throw new Error('User-friendly message');
}
```

## Testing

### Unit Tests
```typescript
describe('Component', () => {
  it('should do something', () => {
    // Test
  });
});
```

### Manual Testing
1. Create account
2. Test all debate features
3. Test on mobile (375px)
4. Check console for errors

## Pull Request

### Title Format
```
type(scope): description
```

### Body Template
```markdown
## Changes
- Change 1
- Change 2

## Testing
- [ ] Lint passes
- [ ] Types check
- [ ] Manual testing complete
- [ ] Mobile tested

Closes #issue
```

## Review Checklist

- [ ] Follows existing patterns
- [ ] No console.log statements
- [ ] Error handling included
- [ ] TypeScript types defined
- [ ] Tests written/updated
- [ ] Documentation updated

## Prohibited

1. Direct commits to main
2. Merging own PRs
3. Skipping tests
4. Exposing secrets
5. Changing core patterns
6. Installing packages without approval