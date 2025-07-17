# Layout System Guide

This guide provides consistent layout patterns for the DebateAI application to ensure uniform spacing, responsive design, and visual consistency across all pages.

## Quick Reference

### Page Containers
```jsx
// Standard page layout
<div className="page-container">
  {/* Max width: 7xl, responsive padding */}
</div>

// Narrow content (forms, articles)
<div className="page-container-narrow">
  {/* Max width: 4xl */}
</div>

// Wide content (dashboards, tables)
<div className="page-container-wide">
  {/* Max width: screen-2xl */}
</div>
```

### Page Headers
```jsx
<div className="page-header">
  <h1 className="page-title">Page Title</h1>
  <p className="page-subtitle">Optional subtitle text</p>
</div>
```

### Card Layouts
```jsx
// 3-column grid (responsive)
<div className="card-grid">
  <Card className="card-spacing">...</Card>
  <Card className="card-spacing">...</Card>
  <Card className="card-spacing">...</Card>
</div>

// 2-column grid
<div className="card-grid-2">
  <Card className="card-spacing">...</Card>
  <Card className="card-spacing">...</Card>
</div>
```

### Form Layouts
```jsx
<form className="form-section">
  <div className="form-group">
    <label>Label</label>
    <EnhancedInput />
  </div>
  
  <div className="form-row">
    <EnhancedInput />
    <EnhancedInput />
  </div>
</form>
```

### Responsive Text
```jsx
<h1 className="text-responsive-2xl">Large Heading</h1>
<h2 className="text-responsive-xl">Medium Heading</h2>
<p className="text-responsive-base">Body text</p>
<span className="text-responsive-sm">Small text</span>
```

### Button Groups
```jsx
// Horizontal
<div className="button-group">
  <EnhancedButton>Save</EnhancedButton>
  <EnhancedButton variant="secondary">Cancel</EnhancedButton>
</div>

// Vertical
<div className="button-group-vertical">
  <EnhancedButton>Option 1</EnhancedButton>
  <EnhancedButton>Option 2</EnhancedButton>
</div>
```

### Empty States
```jsx
<div className="empty-state">
  <svg className="empty-state-icon">...</svg>
  <h3 className="empty-state-title">No items found</h3>
  <p className="empty-state-description">Get started by creating your first item</p>
</div>
```

### Spacing Utilities
- `stack-sm` - 0.5rem vertical spacing
- `stack` - 1rem vertical spacing
- `stack-lg` - 1.5rem vertical spacing
- `inline-stack-sm` - 0.5rem horizontal spacing
- `inline-stack` - 1rem horizontal spacing
- `inline-stack-lg` - 1.5rem horizontal spacing

### Section Spacing
- `section-spacing` - Standard section margins (2-3rem)
- `section-spacing-lg` - Large section margins (3-4rem)

### Content Spacing
- `content-spacing` - Standard content spacing (1-1.5rem)
- `content-spacing-lg` - Large content spacing (1.5-2rem)

## Best Practices

1. **Always use responsive classes** - Text, padding, and margins should scale with screen size
2. **Consistent containers** - Use page-container classes for all main content areas
3. **Semantic spacing** - Use stack utilities for related content, section-spacing for major divisions
4. **Mobile-first approach** - Design for mobile, enhance for desktop
5. **Accessible focus states** - Use focus-ring class on interactive elements

## Examples

### Complete Page Layout
```jsx
<Layout>
  <div className="page-container">
    <div className="page-header">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Welcome back! Here's your overview.</p>
    </div>
    
    <section className="section-spacing">
      <div className="card-grid">
        {/* Cards */}
      </div>
    </section>
    
    <section className="section-spacing">
      <h2 className="text-responsive-xl mb-4">Recent Activity</h2>
      <div className="content-spacing">
        {/* Content items */}
      </div>
    </section>
  </div>
</Layout>
```

### Responsive Form
```jsx
<div className="page-container-narrow">
  <Card className="card-spacing">
    <form className="form-section">
      <h2 className="text-responsive-lg mb-4">Settings</h2>
      
      <div className="form-group">
        <label className="text-responsive-sm">Email</label>
        <EnhancedInput type="email" />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label className="text-responsive-sm">First Name</label>
          <EnhancedInput />
        </div>
        <div className="form-group">
          <label className="text-responsive-sm">Last Name</label>
          <EnhancedInput />
        </div>
      </div>
      
      <div className="button-group mt-6">
        <EnhancedButton type="submit">Save Changes</EnhancedButton>
        <EnhancedButton variant="secondary">Cancel</EnhancedButton>
      </div>
    </form>
  </Card>
</div>
```

This layout system ensures consistency while maintaining the minimalist aesthetic of the application.