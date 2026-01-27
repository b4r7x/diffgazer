# React Principles & Best Practices (2025/2026)

> State-of-the-art React patterns. Load with `/react-principles`.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [React 19 Features](#2-react-19-features)
3. [Component Architecture](#3-component-architecture)
4. [Hooks Deep Dive](#4-hooks-deep-dive)
5. [State Management](#5-state-management)
6. [Memoization Policy](#6-memoization-policy)
7. [Anti-Patterns Encyclopedia](#7-anti-patterns-encyclopedia)
8. [File Organization](#8-file-organization)
9. [TypeScript Integration](#9-typescript-integration)
10. [Quick Reference](#10-quick-reference)

---

## 1. Core Philosophy

### The Golden Rules

1. **No premature optimization** - Write simple code first. Optimize only when profiler shows a problem.
2. **No useMemo/useCallback by default** - React Compiler handles this. Manual memoization is almost never needed.
3. **Derive, don't store** - If a value can be computed from state/props, compute it during render.
4. **Colocate state** - Keep state as close as possible to where it's used.
5. **Single responsibility** - Each component does one thing well.

### Memoization: The Absolute Rule

**NEVER use `useMemo`, `useCallback`, or `React.memo` unless:**

| Allowed Case | Why |
|--------------|-----|
| Context Provider values | Prevents ALL consumers from re-rendering on every parent render |
| useEffect dependency + reused elsewhere | Function needed in effect AND used in JSX or other places |
| PROVEN performance issue | Profiler shows >16ms render time causing dropped frames |

**That's it. Three cases. Everything else: just write the code normally.**

---

## 2. React 19 Features

### 2.1 React Compiler

The React Compiler automatically memoizes your code at build time. This is why manual memoization is unnecessary.

**What it does:**
- Auto-memoizes components (like `React.memo`)
- Auto-caches values (like `useMemo`)
- Auto-stabilizes functions (like `useCallback`)

**Your job:** Write simple, readable code. Let the compiler optimize.

### 2.2 New Hooks

#### useActionState

Replaces manual form state management with loading/error states.

```tsx
"use client";

async function submitForm(prevState: FormState, formData: FormData) {
  const name = formData.get('name') as string;

  try {
    await api.submit({ name });
    return { error: null, success: true };
  } catch (err) {
    return { error: err.message, success: false };
  }
}

function Form() {
  const [state, action, isPending] = useActionState(submitForm, {
    error: null,
    success: false,
  });

  return (
    <form action={action}>
      <input name="name" required disabled={isPending} />
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
      {state.error && <span className="error">{state.error}</span>}
    </form>
  );
}
```

#### useFormStatus

Access parent form's submission state without prop drilling. **Must be in a child component of `<form>`.**

```tsx
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
}

function Form() {
  return (
    <form action={submitAction}>
      <input name="email" />
      <SubmitButton /> {/* Child component, not inline */}
    </form>
  );
}
```

#### useOptimistic

Show instant feedback while async operations complete.

```tsx
function MessageList({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (current, newMessage: Message) => [...current, { ...newMessage, sending: true }]
  );

  async function sendMessage(formData: FormData) {
    const text = formData.get('text') as string;
    addOptimistic({ id: crypto.randomUUID(), text });
    await api.sendMessage({ text });
  }

  return (
    <div>
      {optimisticMessages.map(msg => (
        <div key={msg.id} className={msg.sending ? 'opacity-50' : ''}>
          {msg.text}
        </div>
      ))}
      <form action={sendMessage}>
        <input name="text" />
        <button>Send</button>
      </form>
    </div>
  );
}
```

#### use()

Read promises and context conditionally (after early returns).

```tsx
// Read context after conditional - impossible with useContext
function Component({ show }: { show: boolean }) {
  if (!show) return null;

  const theme = use(ThemeContext); // Works after early return!
  return <div className={theme}>Content</div>;
}

// Read promise (suspends until resolved)
function UserData({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  return <div>{user.name}</div>;
}
```

### 2.3 Server Components

Default in Next.js App Router. Run only on server.

| Server Component (default) | Client Component ("use client") |
|---------------------------|--------------------------------|
| Data fetching | Event handlers (onClick, etc.) |
| Database access | useState, useEffect |
| Sensitive operations | Browser APIs |
| Static content | Interactive elements |

```tsx
// Server Component - no directive needed
async function UserPage({ userId }: { userId: string }) {
  const user = await db.users.find(userId); // Direct DB access
  return <UserProfile user={user} />;
}

// Client Component - needs directive
"use client";
function UserProfile({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  return (
    <div>
      <h1>{user.name}</h1>
      <button onClick={() => setEditing(true)}>Edit</button>
    </div>
  );
}
```

### 2.4 Breaking Changes

| Old (React 18) | New (React 19) |
|---------------|----------------|
| `forwardRef` wrapper | `ref` as regular prop |
| `<Context.Provider value={}>` | `<Context value={}>` |
| `useRef()` | `useRef(null)` - argument required |
| `propTypes` | TypeScript |
| `defaultProps` | ES6 default parameters |

---

## 3. Component Architecture

### 3.1 Functional Components Only

Always use functional components. Only exception: Error Boundaries (require class).

```tsx
// Standard component
function UserCard({ user }: { user: User }) {
  return (
    <div className="user-card">
      <Avatar src={user.avatar} />
      <span>{user.name}</span>
    </div>
  );
}

// Error Boundary (only valid class component)
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}
```

### 3.2 Single Responsibility

Each component should have ONE reason to change.

**Split when:**
- 3+ independent state pieces
- Over 150 lines
- Multiple unrelated event handlers
- Hard to name clearly
- Difficult to test

**Before (God Component):**
```tsx
function Dashboard() {
  const [user, setUser] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  // 10 more useState...
  // 5 useEffects...
  // 300 lines of JSX...
}
```

**After (Separated):**
```tsx
function Dashboard() {
  return (
    <div>
      <UserHeader />
      <AnalyticsPanel />
      <NotificationList />
    </div>
  );
}

function UserHeader() {
  const user = useUser(); // Custom hook
  if (!user) return <Skeleton />;
  return <header>{user.name}</header>;
}
```

### 3.3 Props Design

**Naming:**
| Type | Convention | Example |
|------|------------|---------|
| Boolean | `is*`, `has*`, `can*` | `isLoading`, `hasError`, `canEdit` |
| Handlers | `on*` | `onClick`, `onSubmit`, `onChange` |
| Render slots | `*Content` | `headerContent`, `footerContent` |

**Quantity:**
- 1-4 props: Good
- 5-6 props: Consider grouping
- 7+ props: Split component or use composition

```tsx
// ❌ Too many props
<Card
  title="..." titleSize="lg" titleColor="blue"
  subtitle="..." subtitleSize="sm"
  image="..." imageAlt="..."
  onClick={...} onHover={...}
/>

// ✅ Grouped or composed
<Card>
  <Card.Header title="..." size="lg" />
  <Card.Image src="..." alt="..." />
  <Card.Actions onClick={...} />
</Card>
```

### 3.4 Composition Patterns

**1. Custom Hooks (Primary Pattern)**

Share stateful logic between components.

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```

**2. Compound Components**

Related components with shared implicit state.

```tsx
const TabsContext = createContext<TabsContextType | null>(null);

function Tabs({ children, defaultTab }: TabsProps) {
  const [active, setActive] = useState(defaultTab);

  return (
    <TabsContext value={{ active, setActive }}>
      <div className="tabs">{children}</div>
    </TabsContext>
  );
}

Tabs.Button = function TabButton({ id, children }: TabButtonProps) {
  const { active, setActive } = use(TabsContext)!;
  return (
    <button
      onClick={() => setActive(id)}
      className={active === id ? 'active' : ''}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function TabPanel({ id, children }: TabPanelProps) {
  const { active } = use(TabsContext)!;
  return active === id ? <div>{children}</div> : null;
};

// Usage
<Tabs defaultTab="profile">
  <Tabs.Button id="profile">Profile</Tabs.Button>
  <Tabs.Button id="settings">Settings</Tabs.Button>
  <Tabs.Panel id="profile">Profile content</Tabs.Panel>
  <Tabs.Panel id="settings">Settings content</Tabs.Panel>
</Tabs>
```

**3. Slots Pattern**

Multiple content areas without prop drilling.

```tsx
interface CardProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

function Card({ header, footer, children }: CardProps) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
```

### 3.5 Controlled vs Uncontrolled

| Controlled | Uncontrolled |
|-----------|--------------|
| State in React | State in DOM |
| Real-time validation | On-submit validation |
| Re-render per keystroke | Minimal re-renders |
| Default choice | Performance or simplicity |

```tsx
// Controlled (default)
function ControlledInput() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}

// Uncontrolled (when needed)
function UncontrolledInput() {
  const ref = useRef<HTMLInputElement>(null);
  const handleSubmit = () => console.log(ref.current?.value);
  return <input ref={ref} defaultValue="" />;
}
```

---

## 4. Hooks Deep Dive

### 4.1 useState

**Basic usage:**
```tsx
const [count, setCount] = useState(0);
const [user, setUser] = useState<User | null>(null);
```

**Lazy initialization (expensive initial value only):**
```tsx
// ✅ Function form - runs once
const [data, setData] = useState(() => expensiveComputation());

// ❌ Direct call - runs every render
const [data, setData] = useState(expensiveComputation());
```

**Functional updates (when depending on previous):**
```tsx
// ✅ Always gets latest value
setCount(prev => prev + 1);
setUser(prev => ({ ...prev, name: 'New Name' }));

// ❌ May use stale value in async contexts
setCount(count + 1);
```

### 4.2 useReducer

Use when state has complex update logic or multiple related values.

```tsx
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'set'; value: number };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'increment': return state + 1;
    case 'decrement': return state - 1;
    case 'set': return action.value;
  }
}

function Counter() {
  const [count, dispatch] = useReducer(reducer, 0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
    </div>
  );
}
```

### 4.3 useEffect

**Purpose:** Synchronize with external systems (APIs, DOM, subscriptions).

#### When TO Use

| Use Case | Example |
|----------|---------|
| Data fetching | API calls |
| Subscriptions | WebSocket, event listeners |
| DOM manipulation | Focus, scroll, measure |
| Timers | setInterval, setTimeout |
| Third-party libs | Analytics, charts |

#### When NOT To Use

| Don't Use For | Use Instead |
|---------------|-------------|
| Computing values | Calculate during render |
| Handling events | Event handlers |
| Deriving state | Calculate directly |
| Resetting on prop change | `key` prop |

#### Cleanup Is Mandatory

Every effect that sets something up MUST clean it up.

```tsx
// Event listener
useEffect(() => {
  const handler = () => setWidth(window.innerWidth);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// Timer
useEffect(() => {
  const timer = setInterval(() => tick(), 1000);
  return () => clearInterval(timer);
}, []);

// Subscription
useEffect(() => {
  const sub = eventBus.subscribe(handler);
  return () => sub.unsubscribe();
}, []);

// Fetch with abort
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/user/${id}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setUser)
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });

  return () => controller.abort();
}, [id]);
```

#### Dependency Array Rules

1. **Include all values from component scope used in effect**
2. **useState setters are stable** - don't need inclusion
3. **Avoid object/array deps** - they compare by reference
4. **Move functions inside effect** - or they need useCallback (see [Section 6](#6-memoization-policy))

```tsx
// ✅ Correct
useEffect(() => {
  fetchUser(userId);
}, [userId]);

// ✅ Functional update avoids dependency
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1); // No count dependency needed
  }, 1000);
  return () => clearInterval(timer);
}, []);

// ❌ Missing dependency
useEffect(() => {
  fetchUser(userId); // userId not in deps!
}, []);
```

### 4.4 useRef

**Use cases:**
1. DOM element access
2. Mutable values that don't trigger re-render
3. Storing previous values

```tsx
// DOM access
function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const focus = () => inputRef.current?.focus();
  return <input ref={inputRef} />;
}

// Mutable value (no re-render)
function Timer() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    intervalRef.current = setInterval(() => tick(), 1000);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => stop, []); // Cleanup on unmount
}

// Previous value
function usePrevious<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}
```

### 4.5 useContext

```tsx
// Create with type
interface AuthContextType {
  user: User | null;
  login: (creds: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook for safe access
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be in AuthProvider');
  return ctx;
}

// Provider (see Section 6 for value memoization)
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (creds: Credentials) => {
    const user = await api.login(creds);
    setUser(user);
  };

  const logout = () => setUser(null);

  // MUST memoize context value - one of the three allowed cases
  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
```

### 4.6 Custom Hooks

**Rules:**
- Must start with `use`
- Extract when logic is used in 2+ components
- Keep hooks at top level (no conditionals/loops)

```tsx
// Debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// Media query
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Click outside
function useClickOutside(ref: RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
```

---

## 5. State Management

### 5.1 State Location Decision

```
Where should state live?

1. Used by ONE component only?
   → useState in that component

2. Used by SIBLING components?
   → Lift to common parent

3. Used by DISTANT components?
   → Context (simple) or Zustand/Jotai (complex)

4. SERVER data (from API)?
   → TanStack Query (NOT Redux or useState)

5. Complex with many actions?
   → useReducer or Zustand
```

### 5.2 State Colocation

**Principle:** State should live as close as possible to where it's used.

```tsx
// ❌ State lifted too high
function App() {
  const [searchQuery, setSearchQuery] = useState(''); // Only SearchBar needs this
  return (
    <div>
      <Header />
      <SearchBar query={searchQuery} setQuery={setSearchQuery} />
      <Content />
    </div>
  );
}

// ✅ State colocated
function App() {
  return (
    <div>
      <Header />
      <SearchBar /> {/* Manages own state */}
      <Content />
    </div>
  );
}

function SearchBar() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### 5.3 Derived State

**Rule:** If a value can be computed from state/props, compute it. Don't store it.

```tsx
// ❌ Storing derived state
function Cart({ items }: { items: Item[] }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(items.reduce((sum, i) => sum + i.price, 0));
  }, [items]); // Extra render cycle!

  return <div>Total: ${total}</div>;
}

// ✅ Derive during render
function Cart({ items }: { items: Item[] }) {
  const total = items.reduce((sum, i) => sum + i.price, 0);
  return <div>Total: ${total}</div>;
}
```

### 5.4 Server State vs Client State

| Server State | Client State |
|--------------|--------------|
| From API/database | In browser only |
| Can be stale | Always current |
| TanStack Query | useState/useReducer |

```tsx
// TanStack Query for server state
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUser(userId),
  });

  if (isLoading) return <Loading />;
  return <div>{user.name}</div>;
}

// useState for client state
function Modal() {
  const [isOpen, setIsOpen] = useState(false);
  // ...
}
```

### 5.5 Context Best Practices

**When to use:**
- Theme, locale, auth (low-frequency updates)
- Avoiding prop drilling

**When NOT to use:**
- High-frequency updates (typing, animations)
- Large data sets
- Performance-critical paths

**Performance: Split data from actions:**
```tsx
// Consumers of actions won't re-render when data changes
const DataContext = createContext<Data | null>(null);
const ActionsContext = createContext<Actions | null>(null);

function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initial);

  // Actions are stable (empty deps) - consumers won't re-render
  const actions = useMemo(() => ({
    update: (newData: Data) => setData(newData),
    reset: () => setData(initial),
  }), []);

  return (
    <DataContext value={data}>
      <ActionsContext value={actions}>
        {children}
      </ActionsContext>
    </DataContext>
  );
}
```

### 5.6 Zustand (Medium-Complex State)

```tsx
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
  decrement: () => void;
}

const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set(s => ({ count: s.count + 1 })),
  decrement: () => set(s => ({ count: s.count - 1 })),
}));

// Usage
function Counter() {
  const { count, increment, decrement } = useStore();
  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

// Selective subscription (performance)
function CountDisplay() {
  const count = useStore(s => s.count); // Only re-renders when count changes
  return <span>{count}</span>;
}
```

---

## 6. Memoization Policy

### The Rule

**NEVER use `useMemo`, `useCallback`, or `React.memo` EXCEPT for these three cases:**

### Case 1: Context Provider Values

Context consumers re-render when provider value changes. Without memoization, every parent render creates new object reference → all consumers re-render.

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // ✅ REQUIRED: Memoize context value
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
```

**Split for better performance:**
```tsx
function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);

  // Actions never change - stable reference
  const actions = useMemo(() => ({
    doSomething: () => setState(/*...*/),
  }), []); // Empty deps = never changes

  return (
    <StateContext value={state}>
      <ActionsContext value={actions}>
        {children}
      </ActionsContext>
    </StateContext>
  );
}
```

### Case 2: useEffect Dependency + Reused Elsewhere

When a function is used in useEffect AND elsewhere (JSX, other hooks).

```tsx
function Component({ userId }: { userId: string }) {
  // ✅ REQUIRED: Function used in effect AND in JSX
  const fetchUser = useCallback(async () => {
    const data = await api.getUser(userId);
    setUser(data);
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <div>
      <button onClick={fetchUser}>Refresh</button> {/* Reused here */}
    </div>
  );
}
```

**If only used in effect, move inside:**
```tsx
function Component({ userId }: { userId: string }) {
  useEffect(() => {
    // ✅ Function only used here - define inside
    const fetchUser = async () => {
      const data = await api.getUser(userId);
      setUser(data);
    };
    fetchUser();
  }, [userId]);

  return <div>...</div>;
}
```

### Case 3: PROVEN Performance Issue

Only after profiler shows problem (>16ms render causing dropped frames).

```tsx
function HeavyList({ items, filter }: Props) {
  // ✅ PROVEN: Profiler showed 45ms render, 60fps dropped to 15fps
  // Computation: O(n²) sorting + filtering on 10,000 items
  const processed = useMemo(() => {
    return items
      .filter(i => i.name.includes(filter))
      .sort((a, b) => complexSort(a, b));
  }, [items, filter]);

  return processed.map(item => <Item key={item.id} item={item} />);
}
```

**Document WHY:**
```tsx
// PERF: Profiler showed 32ms render, causes scroll jank on mobile
// This memoization brings it to 4ms
const expensiveValue = useMemo(() => compute(data), [data]);
```

### What NOT To Do

```tsx
// ❌ WRONG: Memoizing everything "just in case"
function Component({ user, items }) {
  const name = useMemo(() => user.firstName + ' ' + user.lastName, [user]); // NO!
  const handleClick = useCallback(() => console.log('clicked'), []); // NO!
  const filtered = useMemo(() => items.filter(i => i.active), [items]); // NO!

  return <div onClick={handleClick}>{name}</div>;
}

// ✅ CORRECT: Just write the code
function Component({ user, items }) {
  const name = user.firstName + ' ' + user.lastName;
  const handleClick = () => console.log('clicked');
  const filtered = items.filter(i => i.active);

  return <div onClick={handleClick}>{name}</div>;
}
```

```tsx
// ❌ WRONG: Wrapping component in memo without reason
const Button = memo(function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>;
});

// ✅ CORRECT: Just the component
function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>;
}
```

### Why This Policy?

1. **React Compiler** handles memoization automatically at build time
2. **Manual memoization has overhead** - comparison cost, memory, complexity
3. **Premature optimization** makes code harder to read and maintain
4. **Most re-renders are cheap** - React is fast, trust it
5. **Profile first** - only optimize what the profiler identifies

---

## 7. Anti-Patterns Encyclopedia

### 7.1 State Anti-Patterns

#### Direct Mutation

```tsx
// ❌ WRONG
const [user, setUser] = useState({ name: 'John', age: 30 });
user.age = 31; // Mutation!
setUser(user); // Same reference, no re-render

// ✅ CORRECT
setUser(prev => ({ ...prev, age: 31 }));
```

#### Array Mutation

```tsx
// ❌ WRONG
items.push(newItem);
setItems(items);

// ✅ CORRECT
setItems(prev => [...prev, newItem]);
```

#### Storing Computed Values

```tsx
// ❌ WRONG: Extra state + effect for derived value
const [items, setItems] = useState([]);
const [total, setTotal] = useState(0);

useEffect(() => {
  setTotal(items.reduce((sum, i) => sum + i.price, 0));
}, [items]);

// ✅ CORRECT: Compute during render
const total = items.reduce((sum, i) => sum + i.price, 0);
```

### 7.2 useEffect Anti-Patterns

#### Missing Dependencies

```tsx
// ❌ WRONG: Runs every render
useEffect(() => {
  fetchData();
}); // No deps array!

// ✅ CORRECT
useEffect(() => {
  fetchData();
}, []);
```

#### Effect for Derived State

```tsx
// ❌ WRONG: Extra render cycle
const [count, setCount] = useState(0);
const [doubled, setDoubled] = useState(0);

useEffect(() => {
  setDoubled(count * 2);
}, [count]);

// ✅ CORRECT: Derive directly
const doubled = count * 2;
```

#### Missing Cleanup

```tsx
// ❌ WRONG: Memory leak
useEffect(() => {
  window.addEventListener('resize', handler);
}, []);

// ✅ CORRECT
useEffect(() => {
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

#### Race Condition

```tsx
// ❌ WRONG: May set stale data
useEffect(() => {
  fetchUser(userId).then(user => setUser(user));
}, [userId]);

// ✅ CORRECT: Abort on cleanup
useEffect(() => {
  const controller = new AbortController();

  fetchUser(userId, { signal: controller.signal })
    .then(setUser)
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });

  return () => controller.abort();
}, [userId]);
```

### 7.3 Hook Rule Violations

#### Conditional Hooks

```tsx
// ❌ WRONG: Hook in conditional
if (isLoggedIn) {
  const [user, setUser] = useState(null);
}

// ❌ WRONG: Hook after early return
if (!show) return null;
const [state, setState] = useState(null);

// ✅ CORRECT: Always call hooks at top level
const [user, setUser] = useState(null);
if (!isLoggedIn) return <Login />;
return <Profile user={user} />;
```

### 7.4 Stale Closure

```tsx
// ❌ WRONG: count is captured at value 0
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count); // Always 0
    setCount(count + 1); // Always sets to 1
  }, 1000);
  return () => clearInterval(timer);
}, []);

// ✅ CORRECT: Functional update
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

### 7.5 Props Drilling

```tsx
// ❌ WRONG: Passing through many levels
<GrandParent user={user} setUser={setUser} />
  → <Parent user={user} setUser={setUser} />
    → <Child user={user} setUser={setUser} />
      → <GrandChild user={user} />

// ✅ CORRECT: Context
const UserContext = createContext(null);

function App() {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);

  return (
    <UserContext value={value}>
      <GrandParent />
    </UserContext>
  );
}

function GrandChild() {
  const { user } = use(UserContext);
  return <div>{user.name}</div>;
}
```

### 7.6 Key Prop Mistakes

```tsx
// ❌ WRONG: Index as key
{items.map((item, index) => (
  <Item key={index} item={item} />
))}

// ❌ WRONG: Random key
{items.map(item => (
  <Item key={Math.random()} item={item} />
))}

// ✅ CORRECT: Stable unique ID
{items.map(item => (
  <Item key={item.id} item={item} />
))}
```

### 7.7 Component Size

```tsx
// ❌ WRONG: God component
function Dashboard() {
  // 20 useState
  // 10 useEffect
  // 300 lines JSX
}

// ✅ CORRECT: Composed
function Dashboard() {
  return (
    <div>
      <Header />
      <Metrics />
      <Charts />
      <Table />
    </div>
  );
}
```

### 7.8 Premature Memoization

```tsx
// ❌ WRONG: Memoizing without reason
const name = useMemo(() => `${first} ${last}`, [first, last]);
const handleClick = useCallback(() => doSomething(), []);
const MemoButton = memo(Button);

// ✅ CORRECT: Just write the code
const name = `${first} ${last}`;
const handleClick = () => doSomething();
function Button() { /* ... */ }
```

---

## 8. File Organization

### Folder Structure

```
src/
├── components/          # Reusable UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── modal.tsx
│   └── card.tsx
│
├── hooks/              # Shared custom hooks
│   ├── use-local-storage.ts
│   ├── use-debounce.ts
│   └── use-media-query.ts
│
├── libs/               # Utilities, API clients
│   ├── api.ts
│   ├── date.ts
│   └── validation.ts
│
├── features/           # Feature modules
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   └── dashboard/
│       ├── components/
│       ├── hooks/
│       └── index.ts
│
├── pages/              # Route components
│   ├── home.tsx
│   └── settings.tsx
│
├── types/              # Shared types
│   └── index.ts
│
└── app.tsx
```

### File Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Components | kebab-case | `user-profile.tsx` |
| Hooks | kebab-case + use- | `use-local-storage.ts` |
| Utils | kebab-case | `date-utils.ts` |
| Types | kebab-case | `user-types.ts` |

### Component File Order

```tsx
// 1. Imports
import { useState, useEffect } from 'react';
import { Button } from '@/components/button';

// 2. Types
interface Props {
  userId: string;
}

// 3. Component
export function UserProfile({ userId }: Props) {
  // 3a. Hooks
  const [user, setUser] = useState(null);

  // 3b. Derived values
  const displayName = user ? `${user.first} ${user.last}` : '';

  // 3c. Effects
  useEffect(() => { /* ... */ }, []);

  // 3d. Handlers
  const handleClick = () => { /* ... */ };

  // 3e. Early returns
  if (!user) return <Loading />;

  // 3f. Render
  return <div>{displayName}</div>;
}
```

---

## 9. TypeScript Integration

### Component Props

```tsx
// Basic
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

// Extending HTML element
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function Input({ label, error, ...props }: InputProps) {
  return (
    <div>
      <label>{label}</label>
      <input {...props} />
      {error && <span>{error}</span>}
    </div>
  );
}
```

### Hook Types

```tsx
// useState
const [user, setUser] = useState<User | null>(null);

// useRef
const inputRef = useRef<HTMLInputElement>(null);

// useReducer
type Action = { type: 'inc' } | { type: 'dec' } | { type: 'set'; value: number };
const [state, dispatch] = useReducer(reducer, 0);

// Custom hook
function useToggle(initial: boolean): [boolean, () => void] {
  const [value, setValue] = useState(initial);
  const toggle = () => setValue(v => !v);
  return [value, toggle];
}
```

### Event Types

```tsx
const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
  console.log(e.clientX);
};
```

---

## 10. Quick Reference

### Hook Selection

| Need | Hook |
|------|------|
| Local state | `useState` |
| Complex state | `useReducer` |
| Side effects | `useEffect` |
| Context | `useContext` / `use()` |
| DOM ref | `useRef` |
| Form action | `useActionState` |
| Form status | `useFormStatus` |
| Optimistic UI | `useOptimistic` |

### State Location

| Situation | Solution |
|-----------|----------|
| Single component | `useState` |
| Siblings need it | Lift to parent |
| App-wide simple | Context |
| App-wide complex | Zustand |
| Server data | TanStack Query |

### Memoization Decision

```
Should I memoize?

1. Is it a Context Provider value?
   → Yes: useMemo the value

2. Is it a function in useEffect AND used elsewhere?
   → Yes: useCallback

3. Does profiler show >16ms render causing jank?
   → Yes: useMemo/memo with comment explaining why

4. Everything else?
   → NO. Just write the code.
```

### Component Checklist

- [ ] Single responsibility?
- [ ] Props minimal?
- [ ] State colocated?
- [ ] Values derived (not stored)?
- [ ] Effects have cleanup?
- [ ] No hook violations?
- [ ] No unnecessary memoization?
