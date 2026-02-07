# Modern UI Component Library Patterns

Reference document for auditing and organizing Stargazer's component library based on patterns from shadcn/ui, Radix UI, Park UI, and Ark UI.

---

## 1. shadcn/ui

### Philosophy
- **Copy-paste, not npm**: Components delivered via CLI that puts source code directly into your project
- **Ownership over distribution**: You own and control the component code
- **Build on primitives**: Uses Radix UI primitives for behavior, adds styling layer
- **Unstyled foundation**: Components have behavior/accessibility, you control appearance

### Component Inventory

**Form Controls:**
- Button, Input, Textarea, Checkbox, Radio Group, Switch, Select, Combobox, Slider

**Display:**
- Card, Badge, Avatar, Skeleton, Separator, Progress, Alert

**Layout:**
- Aspect Ratio, Scroll Area, Resizable, Tabs

**Navigation:**
- Navigation Menu, Menubar, Breadcrumb, Pagination, Command

**Overlays:**
- Dialog, Sheet, Drawer, Popover, Hover Card, Tooltip, Alert Dialog, Context Menu, Dropdown Menu

**Data:**
- Table, Data Table, Calendar, Date Picker

**Feedback:**
- Sonner (toast notifications), Form (with validation)

**Other:**
- Accordion, Carousel, Collapsible, Toggle, Input OTP, Label

### Variant System (CVA)

Uses **class-variance-authority** for systematic, type-safe styling variants:

```typescript
import { cva } from "class-variance-authority"

const buttonVariants = cva(
  "base-classes-here", // Base styles always applied
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10"
      }
    },
    compoundVariants: [
      {
        variant: "destructive",
        size: "lg",
        class: "text-lg font-semibold"
      }
    ],
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```

**Benefits:**
- Type-safe variants
- Compound variants for complex combinations
- Default variants
- Excellent for managing component states (hover, focus, disabled, etc.)

### Color/Theme System

**CSS Variables approach (recommended):**

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... */
  }
}
```

**Semantic tokens:**
- `background` / `foreground` - Base colors
- `card` / `card-foreground` - Card container colors
- `popover` / `popover-foreground` - Overlay colors
- `primary` / `primary-foreground` - Primary action colors
- `secondary` / `secondary-foreground` - Secondary action colors
- `muted` / `muted-foreground` - Subdued content
- `accent` / `accent-foreground` - Emphasis colors
- `destructive` / `destructive-foreground` - Dangerous actions
- `border`, `input`, `ring` - Border/outline colors

**Convention:** Each color has a corresponding `-foreground` for text/icon colors to ensure contrast.

### File Structure

```
src/
├── components/
│   └── ui/                    # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       └── ...
├── lib/
│   └── utils.ts               # cn() helper, etc.
└── styles/
    └── globals.css            # CSS variables
```

**Pattern:**
- Flat structure in `components/ui/`
- Each component is a single file (not folder-per-component)
- Components co-located with related files when needed

### Blocks vs Components

**Components:**
- Individual, reusable UI elements
- Single responsibility (button, input, dialog)
- Building blocks for custom layouts

**Blocks:**
- Pre-built sections/patterns
- Composed of multiple components
- Ready-to-use page sections (login forms, dashboards, pricing tables)
- Can use "Lift mode" to extract individual components from a block

**When to use:**
- **Components**: Building custom UI, need fine-grained control
- **Blocks**: Speed up development with pre-built patterns

### What shadcn/ui Does NOT Include

- No layout components (Grid, Container, Stack, Box)
- No page templates (handled by blocks, not components)
- No complex business logic components
- No data fetching/state management
- No opinionated styling (you control all styles)

---

## 2. Radix UI Primitives

### Philosophy
- **Headless/Unstyled**: Provides behavior and accessibility, zero styling
- **Composable**: Each primitive is broken into functional parts
- **Accessible by default**: Follows WAI-ARIA guidelines
- **Framework of parts**: Open component architecture with granular access

### Component Inventory

**Overlays:**
- Dialog, Alert Dialog, Popover, Tooltip, Hover Card, Context Menu, Dropdown Menu

**Form Controls:**
- Checkbox, Radio Group, Select, Slider, Switch, Label, Toggle, Toggle Group

**Navigation:**
- Navigation Menu, Menubar, Tabs, Toolbar

**Layout/Content:**
- Accordion, Collapsible, Scroll Area, Separator, Aspect Ratio

**Data Display:**
- Avatar, Progress

**Feedback:**
- Toast

**Utilities:**
- Portal, Slot, Visually Hidden, Accessible Icon, Direction Provider

**Preview (New):**
- Form, OTP Field, Password Toggle Field

### Composition Pattern

**Key concept: `asChild` prop**

```typescript
// Without asChild - renders default element
<Dialog.Trigger>
  <button>Open</button>
</Dialog.Trigger>

// With asChild - clones child and merges props
<Dialog.Trigger asChild>
  <button>Open</button>
</Dialog.Trigger>
```

**Benefits:**
- Full control over rendered DOM element
- Merge functionality into your own components
- Avoid wrapper div hell

### Component Parts Pattern

Each primitive exports multiple parts:

```typescript
// Example: Dialog primitive parts
import * as Dialog from '@radix-ui/react-dialog'

<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title />
      <Dialog.Description />
      <Dialog.Close />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Pattern:**
- `.Root` - State management container
- `.Trigger` - Interactive element to open
- `.Portal` - Renders content in portal
- `.Overlay` - Background overlay
- `.Content` - Main content container
- `.Title`, `.Description` - Semantic parts
- `.Close` - Close trigger

### Styling Approach

**No built-in styling:**
- No CSS shipped
- No `css` or `sx` props
- Style with any solution (Tailwind, CSS Modules, styled-components)

**Targeting parts:**
- Each part has `data-*` attributes for styling
- `data-state`, `data-disabled`, `data-orientation`, etc.

```css
[data-radix-dialog-overlay] {
  background: rgba(0, 0, 0, 0.5);
}

[data-radix-dialog-content] {
  background: white;
  border-radius: 8px;
}
```

### Color System (Radix Colors)

Separate package: `@radix-ui/colors`

**Structure:**
- 12-step scales for each color
- Solid and transparent variants
- Designed for accessibility (proper contrast)
- 6 gray scales (pure + 5 tinted)

**Scale steps:**
1. App background
2. Subtle background
3. UI element background
4. Hovered UI element background
5. Active / Selected UI element background
6. Subtle borders and separators
7. UI element border and focus rings
8. Hovered UI element border
9. Solid backgrounds
10. Hovered solid backgrounds
11. Low-contrast text
12. High-contrast text

### What Radix Primitives Does NOT Include

- No styled components (completely unstyled)
- No layout primitives (Stack, Grid, Box, Container)
- No form validation logic
- No data fetching/display components (Table, DataGrid)
- No complex composed patterns (only atomic primitives)
- Missing some common patterns (Drawer, Combobox, Command Palette)

---

## 3. Park UI

### Philosophy
- **Built on Ark UI + Panda CSS**: Styled layer over headless components
- **Framework agnostic**: Supports React, Vue, Solid, Svelte
- **Modular packages**: Different packages per CSS framework
- **Copy-paste like shadcn**: CLI adds components to your project

### Component Approach

**Two-layer architecture:**
1. **Ark UI** - Headless behavior (underneath)
2. **Park UI** - Styled components (on top)

**Supports two CSS frameworks:**
- Panda CSS (CSS-in-JS)
- Tailwind CSS

### Color/Theme System

**Simplified palette:**
- One gray scale
- One accent color
- Derived from Radix Colors with naming tweaks

**Customization via semantic tokens:**

```typescript
// Panda config
export default {
  presets: ['@park-ui/panda-preset'],
  theme: {
    extend: {
      tokens: {
        colors: {
          accent: { /* custom accent scale */ },
          gray: { /* custom gray scale */ }
        }
      }
    }
  }
}
```

### Blocks

Like shadcn/ui, Park UI provides **Blocks** - pre-built patterns combining multiple components (banners, footers, cards, forms).

### What Park UI Does NOT Include

- Same as Ark UI (headless foundation)
- No opinionated layouts
- No complex business logic

---

## 4. Ark UI

### Philosophy
- **Headless component library**: Zero styling, pure behavior
- **Framework agnostic**: React, Vue, Solid, Svelte support
- **Built on Zag.js**: State machines for predictable behavior
- **Compositional architecture**: Components broken into functional parts

### Component Inventory

**45+ components** including:

**Overlays:**
- Dialog, Popover, Tooltip, Hover Card, Menu, Context Menu

**Form Controls:**
- Checkbox, Radio Group, Select, Slider, Switch, Toggle Group, Number Input, Pin Input, Rating, Editable, File Upload, Signature Pad

**Complex Inputs:**
- Color Picker, Date Picker, Tags Input, Combobox

**Data Display:**
- Avatar, Progress, Carousel, Clipboard

**Navigation:**
- Tabs, Accordion, Tree View, Pagination, Breadcrumb

**Layout:**
- Collapsible, Splitter, Presence

**Other:**
- Timer, QR Code, Environment, Portal

### Component Parts with `data-part`

```typescript
// Each part has data-part attribute
<Accordion.Root>
  <Accordion.Item data-part="item">
    <Accordion.ItemTrigger data-part="item-trigger">
      <Accordion.ItemContent data-part="item-content" />
    </Accordion.ItemTrigger>
  </Accordion.Item>
</Accordion.Root>
```

**Styling with slot recipes:**

```typescript
// Panda CSS slot recipe
const accordionSlotRecipe = sva({
  slots: ['root', 'item', 'itemTrigger', 'itemContent'],
  base: {
    root: { /* styles */ },
    item: { /* styles */ },
    itemTrigger: { /* styles */ },
    itemContent: { /* styles */ }
  },
  variants: {
    size: {
      sm: { itemTrigger: { fontSize: 'sm' } },
      md: { itemTrigger: { fontSize: 'md' } }
    }
  }
})
```

### State Machine Architecture

**Powered by Zag.js:**
- Predictable state transitions
- Reduced bugs
- Framework-agnostic logic
- Perfect parity across frameworks

**Benefits:**
- Complex interactions handled correctly
- Accessibility built-in
- Consistent behavior everywhere

### What Ark UI Does NOT Include

- No styling (completely headless)
- No layout components
- No opinionated design tokens
- No pre-built blocks/patterns

---

## Cross-Library Patterns

### Component Categories

Modern libraries organize components into these categories:

**1. Primitives (Atomic)**
- Single responsibility
- No composition
- Examples: Button, Input, Label, Badge, Separator

**2. Form Controls**
- User input elements
- Examples: Checkbox, Radio, Select, Slider, Switch, Textarea

**3. Overlays**
- Positioned above content
- Examples: Dialog, Popover, Tooltip, Dropdown Menu, Context Menu

**4. Navigation**
- Moving between content
- Examples: Tabs, Accordion, Navigation Menu, Breadcrumb, Pagination

**5. Data Display**
- Showing information
- Examples: Table, Card, Avatar, Badge, Progress, Skeleton

**6. Feedback**
- User notifications
- Examples: Toast, Alert, Progress

**7. Utilities**
- Helper components
- Examples: Portal, Slot, Visually Hidden, Aspect Ratio, Scroll Area

**8. Complex/Composed**
- Multi-part patterns
- Examples: Data Table, Command Palette, Date Picker, Combobox

### What Modern Libraries DON'T Include

**Layout Components:**
- Stack, Box, Container, Grid, Flex
- Reason: Too opinionated, many solutions exist (CSS Grid, Flexbox)

**Page Templates:**
- Full page layouts
- Reason: Too specific to use case

**Business Logic:**
- Form validation, data fetching
- Reason: Separate concern (use React Hook Form, Zod, TanStack Query)

**Icons:**
- Usually separate package
- Reason: Large bundle size, many choices exist

**Complex Data Components:**
- Rich text editors, data grids with virtualization
- Reason: Too complex, specialized libraries exist

**Application-Specific:**
- User profiles, settings panels
- Reason: Too opinionated, varies by app

### Headless Philosophy Summary

**What headless components INCLUDE:**
- Behavior and interaction logic
- Keyboard navigation
- Focus management
- ARIA attributes
- State management
- Event handling

**What headless components EXCLUDE:**
- Styles (CSS, colors, spacing)
- Visual design
- Brand identity
- Layout patterns

**Why:**
- Avoid fighting opinionated styles
- Give developers full control
- Separate concerns (logic vs presentation)
- Easier to maintain
- Better tree-shaking

---

## File Organization Patterns

### shadcn/ui Pattern (Flat)

```
components/
└── ui/
    ├── button.tsx
    ├── input.tsx
    ├── card.tsx
    ├── dialog.tsx
    └── ...
```

**Benefits:**
- Simple, easy to navigate
- All components at same level
- Works well with CLI tools

### Folder-per-Component Pattern

```
components/
└── ui/
    ├── button/
    │   ├── button.tsx
    │   ├── button.test.tsx
    │   ├── button.stories.tsx
    │   └── index.ts
    ├── input/
    │   └── ...
    └── ...
```

**Benefits:**
- Related files colocated
- Scales better for complex components
- Clearer ownership

### Category-Based Pattern

```
components/
├── primitives/
│   ├── button.tsx
│   ├── input.tsx
│   └── badge.tsx
├── overlays/
│   ├── dialog.tsx
│   ├── popover.tsx
│   └── tooltip.tsx
├── navigation/
│   ├── tabs.tsx
│   └── accordion.tsx
└── data-display/
    ├── table.tsx
    └── card.tsx
```

**Benefits:**
- Organized by purpose
- Easy to find components
- Clear boundaries

---

## Variant System Patterns

### CVA (Class Variance Authority)

**Best for:** Tailwind CSS, utility-first approaches

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```

### Panda CSS Recipes

**Best for:** CSS-in-JS with type safety

```typescript
const button = cva({
  base: {
    display: 'inline-flex',
    borderRadius: 'md'
  },
  variants: {
    variant: {
      solid: { bg: 'primary', color: 'white' },
      outline: { borderWidth: '1px' }
    },
    size: {
      sm: { px: 3, py: 2 },
      md: { px: 4, py: 2 }
    }
  },
  defaultVariants: {
    variant: 'solid',
    size: 'md'
  }
})
```

### Data Attributes

**Best for:** Headless components, framework-agnostic

```tsx
<Button data-variant="primary" data-size="lg">
  Click me
</Button>
```

```css
[data-variant="primary"] {
  background: var(--primary);
}

[data-size="lg"] {
  padding: 1rem 2rem;
}
```

---

## Color System Patterns

### Semantic Token Approach (shadcn/ui)

**Convention:** Background + Foreground pairs

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
}
```

**Usage:**
```tsx
<div className="bg-primary text-primary-foreground">
  Text is always readable
</div>
```

### Scale-Based Approach (Radix Colors)

**Convention:** 12-step scales

```css
:root {
  --gray-1: /* App background */;
  --gray-2: /* Subtle background */;
  /* ... */
  --gray-12: /* High contrast text */;
}
```

**Usage:**
```tsx
<div className="bg-gray-2 text-gray-12">
  <!-- Uses step 2 and 12 from scale -->
</div>
```

### Hybrid Approach (Park UI)

**Convention:** Simplified scales + semantic tokens

```css
:root {
  --accent: var(--blue-9);
  --accent-foreground: white;
  --muted: var(--gray-3);
}
```

---

## Key Takeaways for Stargazer

### 1. Component Scope
- Include: Primitives, form controls, overlays, navigation, data display
- Exclude: Layouts, page templates, business logic, icons

### 2. Variant Strategy
- Use CVA with Tailwind CSS
- Define base styles + variants + compound variants
- Always include default variants

### 3. Color System
- Use semantic tokens (background + foreground pairs)
- Support light/dark modes via CSS variables
- HSL format for better manipulation

### 4. File Structure
- Flat structure in `components/ui/` for simple components
- Folder-per-component for complex ones
- Colocate tests, stories, utilities

### 5. Composition Pattern
- Build primitives first
- Compose into complex components
- Use `asChild` pattern for flexibility

### 6. Categories to Organize
- Primitives: Button, Input, Badge, Label, Separator
- Overlays: Dialog, Popover, Tooltip, Dropdown
- Navigation: Tabs, Accordion, Breadcrumb
- Data Display: Table, Card, Avatar, Progress
- Form Controls: Checkbox, Radio, Select, Switch
- Feedback: Toast, Alert, Skeleton
- Utilities: Portal, Scroll Area, Aspect Ratio

### 7. What NOT to Build
- Layout primitives (Stack, Box, Grid) - use Tailwind utilities
- Page templates - too specific
- Form validation - use Zod
- Data fetching - use TanStack Query
- Icons - use separate icon library
- Rich text editors - use specialized library
- Complex data grids - use TanStack Table

---

## Sources

- [Introduction - shadcn/ui](https://ui.shadcn.com/docs)
- [Components - shadcn/ui](https://ui.shadcn.com/docs/components)
- [The anatomy of shadcn/ui](https://manupa.dev/blog/anatomy-of-shadcn-ui)
- [Shadcn UI Best Practices for 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44)
- [Theming - shadcn/ui](https://ui.shadcn.com/docs/theming)
- [Class Variance Authority](https://cva.style/docs)
- [Introduction – Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Radix Primitives](https://www.radix-ui.com/primitives)
- [Composition – Radix Primitives](https://www.radix-ui.com/primitives/docs/guides/composition)
- [Color – Radix Themes](https://www.radix-ui.com/themes/docs/theme/color)
- [Home | Park UI](https://park-ui.com/)
- [Colors | Park UI](https://park-ui.com/docs/theme/colors)
- [Home | Ark UI](https://ark-ui.com/)
- [GitHub - chakra-ui/ark](https://github.com/chakra-ui/ark)
- [Styling | Ark UI](https://ark-ui.com/docs/guides/styling)
- [Blocks - shadcn/ui](https://ui.shadcn.com/docs/blocks)
- [Headless components in React and why I stopped using a UI library](https://medium.com/@nirbenyair/headless-components-in-react-and-why-i-stopped-using-ui-libraries-a8208197c268)
- [How headless components became the future for building UI libraries](https://www.subframe.com/blog/how-headless-components-became-the-future-for-building-ui-libraries)
