# Web Implementation Workflow – Complete Guide

**Created:** 2026-01-27

This workflow package provides a comprehensive, phased approach to building the Stargazer web UI from 26 Tailwind CSS mockups.

---

## Documents in This Workflow

### 1. **web-implementation-phases.md** (PRIMARY)
The master document. Contains:
- 5-phase implementation plan (Foundation → Design System → Features → Modals → Audit)
- Detailed specifications for each phase
- File structure and dependencies
- Testing approach per phase
- Acceptance criteria
- Time estimates: **10–15 days total**

**Start here** if you're setting up the project.

### 2. **web-implementation-quick-ref.md** (DEVELOPER GUIDE)
Quick lookup reference while coding. Contains:
- Phase quick-start checklists
- Component patterns (hooks, forms, keyboard navigation)
- Design token cheat sheet
- Common code patterns
- Testing template
- Debugging tips

**Use during implementation** for fast answers.

### 3. **mockups-mapping.md** (VISUAL REFERENCE)
Maps all 26 mockups to specific components and screens. Contains:
- Mockup #1–#26 descriptions
- Component-to-mockup reverse map
- Visual patterns from mockups (colors, typography, spacing)
- Testing against mockups checklist
- File location for viewing each mockup

**Reference when building UI** to ensure accuracy against designs.

---

## Quick Start

### Step 1: Review the Plan
```bash
cat .claude/workflows/web-implementation-phases.md
# Read: Overview, Goals, Files to Create for Phase 1
```

### Step 2: Start Development
```bash
cd apps/web
npm run dev
# Start implementing Phase 1 (Primitives)
# Follow Phase 1 checklist from web-implementation-phases.md
```

### Step 3: Reference During Development
```bash
# Look up button pattern:
grep -A 20 "Button" .claude/workflows/web-implementation-quick-ref.md

# Find a mockup:
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_1/code.html"

# Check component mapping:
grep -B2 -A2 "Button" .claude/workflows/mockups-mapping.md
```

### Step 4: Commit Each Phase
```bash
# After completing Phase 1
git add apps/web/src/components/ui
git commit -m "Phase 1: Add UI primitives (button, input, badge, etc.)"
```

---

## Document Reading Order

**For Project Setup:**
1. web-implementation-phases.md (Overview, Phase 1 Goals, Files)
2. mockups-mapping.md (understand visual reference)
3. web-implementation-quick-ref.md (understand patterns)

**For Each Phase:**
1. web-implementation-phases.md (that phase's section)
2. mockups-mapping.md (find relevant mockups)
3. web-implementation-quick-ref.md (lookup code patterns)

**For Debugging:**
1. web-implementation-quick-ref.md (Debugging Tips section)
2. web-implementation-phases.md (check acceptance criteria)
3. mockups-mapping.md (verify visual accuracy)

---

## Phase Overview (From web-implementation-phases.md)

| Phase | Goal | Components | Timeline |
|-------|------|-----------|----------|
| 1 | Foundation & Design System | Button, Input, Badge, Card, Tabs, Modal, etc. | 2–3 days |
| 2 | Layout Components | Header, Footer, SplitPane, Sidebar, ContentPanel | 2–3 days |
| 3A | Home Menu Screen | Main menu with quick actions | <1 day |
| 3B | Review Screen (CRITICAL) | Split-pane issue list + details + diff viewer | 4–5 days |
| 3C | History Page | Table with sorting/filtering | 2–3 days |
| 3D | Settings Page | Tabs for provider, permissions, diagnostics | 2–3 days |
| 4 | Modals & Polish | Trust, setup wizard, agent inspector, confirm | 1–2 days |
| 5 | Accessibility & Performance | Audit, optimization, testing | 1–2 days |

**Critical Path:** Phase 1 → Phase 2 → Phase 3B (Review Screen)

---

## Key Files Reference

### Mockups Directory
```bash
/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/

# 26 mockups numbered 1–26
# Each mockup in directory: stargazer_issue_review_dashboard_N/
#   ├── code.html          (Full mockup HTML with Tailwind)
#   └── screenshot.png     (Visual preview, if available)

# View mockup:
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_1/code.html"
```

### Web App Source
```bash
/Users/voitz/Projects/stargazer/apps/web/src/

# After Phase 1:
apps/web/src/components/ui/          (primitives)

# After Phase 2:
apps/web/src/components/layout/      (layout components)

# After Phase 3:
apps/web/src/features/menu/          (home menu)
apps/web/src/features/review/        (review screen)
apps/web/src/features/history/       (history page)
apps/web/src/features/settings/      (settings page)

# After Phase 4:
apps/web/src/features/modals/        (modals)
```

### Configuration
```bash
apps/web/tailwind.config.ts           (design tokens)
apps/web/src/styles/globals.css       (reset, base layer)
apps/web/vite.config.ts               (build config, already set up)
```

---

## Commands Reference

### Development
```bash
cd /Users/voitz/Projects/stargazer
npm run dev                     # Start dev server (Vite on port 5173)
npm run type-check              # TypeScript check
npm run build                   # Build all packages
```

### Testing
```bash
npx vitest run                  # Run all tests
npx vitest run src/features/review/  # Run specific test suite
npx vitest run --ui             # Interactive test dashboard
npx vitest run --coverage       # Coverage report
```

### Git Workflow
```bash
# Create feature branch (start of Phase 1)
git checkout -b feature/web-phase-1

# Commit after each phase
git add apps/web/src/components/ui
git commit -m "Phase 1: Add UI primitives"

# Push and create PR
git push origin feature/web-phase-1
```

---

## Design Tokens (Phase 1)

From mockups, extract these design tokens for Tailwind:

### Colors
```css
--primary: #79C0FF;              /* Starlight blue - active states, links */
--secondary: #BC8CFF;            /* Aurora violet - accents */
--background: #0A0E14;           /* Main background */
--surface: #161B22;              /* Card/panel background */
--border: #30363d;               /* Subtle borders */
--success: #3FB950;              /* Green */
--warning: #D29922;              /* Yellow */
--destructive: #FF7B72;          /* Red */
```

### Fonts
```css
--font-display: 'Space Grotesk';      /* Headings, nav (600–700 weight) */
--font-body: 'Inter';                 /* Body text (400–500 weight) */
--font-mono: 'JetBrains Mono';        /* Code, errors (400–500 weight) */
```

---

## Testing Strategy (From web-implementation-phases.md)

### Unit Tests (Phase 1–2)
- Test primitives: Button variants, Input states, Badge colors
- Test layout: Header structure, Footer content, SplitPane resizing
- Use Vitest + React Testing Library
- Template: See `web-implementation-quick-ref.md`

### Integration Tests (Phase 3)
- Load data from API mock
- Click UI → verify state updates
- Filter/sort → verify list changes
- Navigate → verify route changes

### E2E Tests (Phase 4–5)
- Full workflow: navigate → select issue → apply patch → confirm
- Modal flow: open → fill form → submit → close
- Error handling: network failure, validation, server errors

### Accessibility (Phase 5)
- Keyboard navigation: Tab, Arrow keys, Enter, Escape
- Screen reader: ARIA labels, roles, landmarks
- Color contrast: ≥4.5:1 for text
- Focus states: visible outlines on all interactive elements

---

## Critical Decisions (From CLAUDE.md)

Follow these architecture decisions when implementing:

| ADR | Rule |
|-----|------|
| 0001 | Use `Result<T, E>` for errors, not exceptions |
| 0002 | Abstract AI providers, always show selection UI |
| 0003 | CORS localhost only (security) |
| 0004 | XML escape user content in prompts (security) |
| 0005 | Use `responseSchema` for AI JSON, 65536 max tokens |

**Import patterns:**
```typescript
import { api } from '@repo/api';            // API client
import { ok, err } from '@repo/core/result'; // Error handling
import Button from '@/components/ui/button'; // Absolute imports
```

---

## Common Patterns

### Component Template
```typescript
interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

export function MyComponent({ variant = "primary", size = "md", ...props }: MyComponentProps) {
  return (
    <div className={clsx(
      "base-styles",
      variant === "primary" && "primary-styles",
      size === "sm" && "sm-styles",
    )} {...props}>
      Content
    </div>
  );
}
```

### Fetch Data
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  api.fetchData()
    .then(result => setData(result.data))
    .catch(err => setError(err))
    .finally(() => setLoading(false));
}, []);

if (loading) return <LoadingSkeleton />;
if (error) return <ErrorMessage error={error} />;
return <div>{/* render data */}</div>;
```

### Form with Validation
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  apiKey: z.string().min(1, 'API key required'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

See `web-implementation-quick-ref.md` for more patterns.

---

## Troubleshooting

### "Can't find mockup"
```bash
# All mockups are in:
/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/

# List them:
ls "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/" | head -10

# View specific mockup:
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_4/code.html"
```

### "What component am I building?"
```bash
# Open mockups-mapping.md and search for your component name
grep "main-menu" .claude/workflows/mockups-mapping.md
# Result: "Component: apps/web/src/features/menu/components/main-menu.tsx"
# "Mockup reference: Mockup #4 (Stargazer TUI Home Menu)"
```

### "How do I test this?"
```bash
# See Pattern section in web-implementation-quick-ref.md
# Or check Phase 1–5 in web-implementation-phases.md under "Testing Approach"
```

### "TypeScript errors?"
```bash
npm run type-check          # Check all errors
npm run type-check web      # Check just web app
```

---

## Success Criteria

After completing all phases, verify:

- [ ] **Phase 1:** All 8 UI primitives created with ≥2 variants each
- [ ] **Phase 2:** Header, footer, split-pane, sidebar render correctly
- [ ] **Phase 3A:** Home menu navigates to correct routes
- [ ] **Phase 3B:** Review screen loads, filters, sorts, applies patches
- [ ] **Phase 3C:** History page shows past reviews, sortable
- [ ] **Phase 3D:** Settings page saves API config, shows diagnostics
- [ ] **Phase 4:** Modals open/close, forms validate
- [ ] **Phase 5:** Lighthouse ≥90, keyboard navigation works, color contrast ✓

---

## Next Steps

1. **Read** `web-implementation-phases.md` (full overview)
2. **Review** mockups #1, #4, #5 to understand main screens
3. **Start** Phase 1: Create UI primitives (2–3 days)
4. **Commit** after Phase 1 complete
5. **Continue** with Phase 2–5 following the checklist

---

## Questions?

- **Architecture:** See `../docs/` and `../decisions.md`
- **Components:** Check `../workflows/web-implementation-quick-ref.md`
- **Mockups:** Search `../workflows/mockups-mapping.md`
- **Patterns:** Look in existing code: `apps/web/src/features/`

---

## Estimated Timeline

- **Phase 1:** 2–3 days
- **Phase 2:** 2–3 days
- **Phase 3A:** < 1 day
- **Phase 3B:** 4–5 days (critical path)
- **Phase 3C:** 2–3 days
- **Phase 3D:** 2–3 days
- **Phase 4:** 1–2 days
- **Phase 5:** 1–2 days

**Total: 10–15 days for 1–2 developers**

---

## Document Metadata

| File | Purpose | Size |
|------|---------|------|
| web-implementation-phases.md | Master plan | ~26 KB |
| web-implementation-quick-ref.md | Developer guide | ~14 KB |
| mockups-mapping.md | Visual reference | ~14 KB |
| WEB-IMPLEMENTATION-README.md | This file | ~8 KB |

All files in: `.claude/workflows/`
