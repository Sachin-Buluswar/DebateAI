# Navigation Architecture Documentation

## Overview
The Eris Debate application uses a route group pattern for managing navigation across authenticated pages. This ensures consistent navigation UI/UX throughout the application while keeping certain pages (auth, landing) navigation-free.

## Architecture Pattern: Route Groups

### Structure
```
src/app/
├── (authenticated)/        # Route group with navigation
│   ├── layout.tsx         # Wraps all child pages with Layout component
│   ├── dashboard/
│   ├── debate/
│   ├── speech-feedback/
│   ├── search/
│   ├── history/
│   ├── preferences/
│   ├── feedback/
│   └── learn/
├── auth/                  # No navigation (login/signup)
├── api/                   # API routes
└── page.tsx              # Landing page (no navigation)
```

### Key Components

#### 1. Authenticated Layout (`/src/app/(authenticated)/layout.tsx`)
- **Purpose**: Wraps all authenticated pages with navigation
- **Features**:
  - Authentication check on mount
  - Redirects to `/auth` if not authenticated
  - Provides consistent Layout wrapper
  - Manages auth state changes

#### 2. Layout Component (`/src/components/layout/Layout.tsx`)
- **Purpose**: Provides the navigation structure
- **Features**:
  - Fixed navbar at top
  - Collapsible sidebar (desktop only)
  - Mobile hamburger menu
  - Dark mode support
  - Responsive design

#### 3. Navbar Component (`/src/components/layout/Navbar.tsx`)
- **Purpose**: Top navigation bar
- **Features**:
  - Logo/brand
  - Desktop navigation links (hidden when sidebar visible)
  - Dark mode toggle
  - Profile menu
  - Mobile menu trigger

#### 4. Sidebar Component (`/src/components/layout/Sidebar.tsx`)
- **Purpose**: Side navigation panel (desktop only)
- **Features**:
  - Collapsible with icons
  - Navigation links with active states
  - Responsive to screen size
  - Smooth animations

## Navigation Flow

### Desktop Experience
1. User logs in → Redirected to `/dashboard`
2. Navbar appears at top with logo
3. Sidebar appears on left with navigation links
4. Sidebar can be collapsed to icon-only view
5. Main content adjusts margin based on sidebar state

### Mobile Experience
1. User logs in → Redirected to `/dashboard`
2. Navbar appears at top with hamburger menu
3. Clicking hamburger opens full-screen navigation menu
4. Navigation menu shows all links in large, centered format
5. Selecting a link closes the menu

## Route Configuration

### Authenticated Routes (with navigation)
- `/dashboard` - Main dashboard
- `/debate` - Debate practice
- `/speech-feedback` - Speech analysis
- `/search` - Evidence search
- `/history` - Past debates and speeches
- `/preferences` - User settings
- `/feedback` - Feedback view
- `/learn` - Educational resources

### Unauthenticated Routes (no navigation)
- `/` - Landing page
- `/auth` - Login/signup
- `/login` - Redirects to `/auth`
- `/signup` - Redirects to `/auth`

## Implementation Details

### Authentication Check
```typescript
// In (authenticated)/layout.tsx
useEffect(() => {
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth');
      return;
    }
    setAuthenticated(true);
  };
  checkAuth();
}, []);
```

### Sidebar Context
The Layout component provides a sidebar context that allows:
- Toggle sidebar collapsed state
- Share state between Navbar and Sidebar
- Consistent behavior across pages

### Path Detection
The Layout component detects the current path to:
- Show/hide sidebar based on route
- Highlight active navigation items
- Adjust layout margins

## Styling Considerations

### CSS Classes
- Fixed positioning for navbar: `fixed w-full z-40 top-0`
- Sidebar transitions: `transition-all duration-300`
- Content margins adjust: `lg:ml-20` (collapsed) or `lg:ml-64` (expanded)
- Mobile menu: `translate-x-0` (open) or `translate-x-full` (closed)

### Dark Mode
- Automatic theme detection
- Manual toggle in navbar
- Consistent colors across light/dark themes

## Benefits of This Architecture

1. **Single Source of Truth**: Navigation logic in one place
2. **Consistent UX**: All authenticated pages have same navigation
3. **Performance**: Layout component loads once, persists across navigation
4. **Maintainability**: Easy to add/remove pages or change navigation
5. **Flexibility**: Different layouts for different route groups
6. **SEO Friendly**: Server-side rendering compatible
7. **Type Safety**: Full TypeScript support

## Common Tasks

### Adding a New Authenticated Page
1. Create folder in `/src/app/(authenticated)/`
2. Add `page.tsx` file
3. Page automatically gets navigation

### Adding a New Unauthenticated Page
1. Create folder in `/src/app/`
2. Add `page.tsx` file
3. No navigation appears

### Modifying Navigation Links
1. Edit `/src/components/layout/Navbar.tsx` (mobile menu)
2. Edit `/src/components/layout/Sidebar.tsx` (desktop sidebar)
3. Update both to keep consistency

## Troubleshooting

### Navigation Not Appearing
- Check page is in `(authenticated)` folder
- Verify authentication status
- Check browser console for errors

### Double Navigation
- Ensure pages don't import Layout directly
- Check for duplicate Layout wrappers

### Mobile Menu Issues
- Verify viewport meta tag is set
- Check z-index conflicts
- Test touch events

## Testing Checklist

- [ ] All authenticated pages show navigation
- [ ] Unauthenticated pages have no navigation
- [ ] Sidebar collapses/expands correctly
- [ ] Mobile menu opens/closes properly
- [ ] Active states highlight correctly
- [ ] Dark mode toggles work
- [ ] Authentication redirects work
- [ ] Page transitions are smooth
- [ ] No layout shift on navigation