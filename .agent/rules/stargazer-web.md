# Stargazer Web Rules

These rules apply to all work in `apps/web/`.

## Architecture Rules

### File Naming
- ALL files use **kebab-case**: `review-panel.tsx`, not `ReviewPanel.tsx`
- Test files: `[name].test.tsx`
- Hook files: `use-[name].ts`

### Import Rules
- Use `@/` prefix for absolute imports
- Features CANNOT import from other features
- Shared code goes in `components/`, `hooks/`, or packages

### Package Usage
- Types: Import from `@repo/schemas`
- API client: Import from `@repo/api`
- Business logic: Import from `@repo/core`
- UI primitives: Import from `@repo/ui` (when created)

## Code Style

### Components
- Use function declarations, not arrow functions for components
- Props interface above component
- Export component, not default export

```typescript
// Good
interface ReviewPanelProps {
  issues: TriageIssue[];
}

export function ReviewPanel({ issues }: ReviewPanelProps) {
  return <div>...</div>;
}

// Bad
export default ({ issues }) => <div>...</div>;
```

### Hooks
- Prefix with `use`
- Return object with named properties
- Handle loading, error, data states

```typescript
export function useReview(id: string) {
  const [data, setData] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ...

  return { data, isLoading, error };
}
```

### Error Handling
- Use Result type from `@repo/core` for API calls
- Show user-friendly error messages
- Log errors for debugging

## Security Rules

### API Calls
- All API calls go through `@repo/api` client
- Never expose API keys in frontend code
- Use environment variables for configuration

### CORS
- Only connect to localhost origins
- Include credentials for CORS requests

### Content Security
- Escape user content before rendering
- Use `escapeXml` from `@repo/core` for any user-provided content

## Performance Rules

### React
- Don't add manual memoization (React 19 Compiler handles it)
- Use Suspense for code splitting
- Lazy load heavy components

### Bundle
- Keep initial bundle small
- Use dynamic imports for features
- Tree-shake unused code

## Accessibility Rules

### Keyboard
- All interactive elements must be keyboard accessible
- Focus states must be visible
- Tab order must be logical

### Screen Readers
- Use semantic HTML
- Add ARIA labels where needed
- Test with screen reader

### Visual
- Maintain 4.5:1 contrast ratio
- Don't use color as only indicator
- Support reduced motion preference
