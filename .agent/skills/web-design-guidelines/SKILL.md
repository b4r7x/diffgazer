# Web Design Guidelines

## Core Principles

### 1. Visual Hierarchy
- Use size, weight, and color to establish importance
- Primary actions should be visually prominent
- Secondary elements should be subdued
- Maintain consistent visual weight across similar elements

### 2. Spacing System (8px Grid)
- Base unit: 8px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Use consistent spacing for similar contexts
- Padding inside components, margin between components

### 3. Typography
- Maximum 2 font families (1 for headings, 1 for body)
- Clear hierarchy: Display > Heading > Subheading > Body > Caption
- Line height: 1.2-1.3 for headings, 1.5-1.6 for body
- Font scale: 12, 14, 16, 18, 20, 24, 32, 40, 48

### 4. Color System
- **Semantic colors**: success, warning, error, info
- **Neutral palette**: 9 shades (50-900)
- **Brand colors**: Primary, secondary (used sparingly)
- Maintain 4.5:1 contrast ratio (WCAG AA)
- Support dark/light themes

### 5. Component States
Every interactive element needs:
- Default state
- Hover state (subtle change)
- Focus state (visible outline for a11y)
- Active/pressed state
- Disabled state (reduced opacity, no pointer)
- Loading state (skeleton or spinner)

### 6. Loading States
- Prefer skeleton screens over spinners
- Show loading state immediately (no flash)
- Preserve layout during loading
- Progressive loading for lists

### 7. Error States
- Clear error messaging
- Explain what went wrong
- Provide actionable next steps
- Don't blame the user

### 8. Empty States
- Explain why it's empty
- Provide clear call-to-action
- Use illustration if appropriate
- Guide user to next step

### 9. Responsive Design
- Mobile-first approach
- Breakpoints: 640, 768, 1024, 1280, 1536px
- Fluid typography and spacing
- Touch-friendly targets (min 44x44px)

### 10. Accessibility
- WCAG 2.1 AA minimum
- Keyboard navigable
- Screen reader friendly
- Focus visible
- Color not sole indicator
- Reduced motion support

## Component Patterns

### Cards
```
- Border radius: 8-12px
- Padding: 16-24px
- Shadow: subtle (0 1px 3px rgba(0,0,0,0.1))
- Hover: slight elevation change
```

### Buttons
```
- Primary: filled, brand color
- Secondary: outlined or ghost
- Destructive: red tones
- Height: 32 (sm), 40 (md), 48 (lg)
- Min width: content + 32px padding
```

### Forms
```
- Labels above inputs
- Error messages below inputs
- Required indicator: asterisk or "Required"
- Validation on blur + submit
- Clear focus states
```

### Navigation
```
- Current page indicator
- Consistent placement
- Breadcrumbs for deep hierarchy
- Mobile: hamburger or bottom nav
```

### Data Display
```
- Tables for comparison
- Lists for sequential data
- Cards for entity browsing
- Pagination: prefer infinite scroll for mobile
```

## Anti-patterns to Avoid

- Icon-only buttons without labels/tooltips
- Low contrast text
- Walls of text without hierarchy
- Nested modals
- Horizontal scrolling on mobile
- Disabled buttons without explanation
- Form fields without labels
- Auto-playing media
- Scroll hijacking
- Hidden navigation

## Stargazer-Specific Guidelines

### Issue Severity Colors
```css
--severity-blocker: #ef4444;  /* red-500 */
--severity-high: #f97316;     /* orange-500 */
--severity-medium: #eab308;   /* yellow-500 */
--severity-low: #3b82f6;      /* blue-500 */
--severity-nit: #6b7280;      /* gray-500 */
```

### Agent Status Colors
```css
--agent-queued: var(--neutral-400);
--agent-running: var(--cyan-500);
--agent-complete: var(--green-500);
--agent-error: var(--red-500);
```

### Code Display
- Monospace font: JetBrains Mono, Fira Code, or system mono
- Syntax highlighting (match user's editor theme if possible)
- Line numbers for context
- Diff highlighting: green for additions, red for deletions
