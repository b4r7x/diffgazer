# Keyboard Navigation System

Centralized keyboard shortcut handling with scope-based blocking for modals and overlays.

## Architecture

```
KeyboardProvider (single global keydown listener)
    |
    v
Scope Stack: "global" -> "modal" -> "dialog"
    |
    v
Only active scope receives events
```

**Key design decisions:**

1. **Single listener** - One `window.addEventListener('keydown')` in the provider, not per-component
2. **Scope blocking** - When a modal opens, it pushes a new scope; page hotkeys stop firing
3. **Input bypass** - Events in `<input>`, `<textarea>`, `<select>`, or `contentEditable` are ignored
4. **Auto-cleanup** - Hooks return unsubscribe functions automatically

## Setup

Wrap your app with `KeyboardProvider`:

```tsx
// app/layout.tsx
import { KeyboardProvider } from '@/components/keyboard';

export default function Layout({ children }) {
  return (
    <KeyboardProvider>
      {children}
    </KeyboardProvider>
  );
}
```

## API Reference

### useKey

Register a hotkey in the current scope.

```tsx
import { useKey } from '@/hooks/keyboard/use-key';

function IssueList() {
  useKey('j', () => selectNext());
  useKey('k', () => selectPrev());
  useKey('Enter', () => openSelected());
  useKey('Ctrl+c', () => copyToClipboard());
  useKey('?', () => showHelp(), { enabled: !helpVisible });
}
```

**Hotkey format:**
- Single key: `j`, `Enter`, `Escape`, `ArrowUp`
- With modifiers: `Ctrl+s`, `Meta+k`, `Shift+?`, `Alt+n`
- Aliases: `up`/`down`/`left`/`right`, `esc`, `space`

**Options:**
- `enabled?: boolean` - Conditionally enable/disable the hotkey

### useScope

Push a blocking scope. Previous scope handlers stop firing.

```tsx
import { useScope } from '@/hooks/keyboard/use-scope';
import { useKey } from '@/hooks/keyboard/use-key';

function Modal({ onClose }) {
  useScope('modal');  // Blocks parent scope until unmount

  useKey('Escape', onClose);  // Registered to 'modal' scope
  useKey('Enter', submit);
}
```

**Behavior:**
1. On mount: saves previous scope, sets new scope
2. Hotkeys registered after `useScope` bind to the new scope
3. On unmount: restores previous scope

### useNavigableList

Arrow key navigation for lists with wrap-around.

```tsx
import { useNavigableList } from '@/hooks/keyboard/use-navigable-list';

function IssueList({ issues }) {
  const { index, setIndex } = useNavigableList({
    items: issues,
    onActivate: (issue) => router.push(`/issues/${issue.id}`),
  });

  return (
    <ul>
      {issues.map((issue, i) => (
        <li key={issue.id} data-selected={i === index}>
          {issue.title}
        </li>
      ))}
    </ul>
  );
}
```

**Bindings:**
- `ArrowUp` - Move selection up (wraps to bottom)
- `ArrowDown` - Move selection down (wraps to top)
- `Enter` - Calls `onActivate` with current item

### Utility Functions

Located in `lib/keyboard.ts`:

```tsx
import { matchesHotkey, isInputElement } from '@/lib/keyboard';

// Check if event matches hotkey string
matchesHotkey(event, 'Ctrl+s');  // true/false

// Check if target is an input element
isInputElement(event.target);  // true for input/textarea/select/contentEditable
```

## Scope Blocking Example

```
Initial state: activeScope = "global"

1. Page mounts
   - useKey('j', selectNext) -> registered to "global"
   - useKey('?', showHelp) -> registered to "global"

2. Modal opens
   - useScope('modal') -> activeScope = "modal", prev = "global"
   - useKey('Escape', close) -> registered to "modal"

   Now: 'j' and '?' don't fire (wrong scope)
        'Escape' fires (correct scope)

3. Modal closes (unmounts)
   - useScope cleanup -> activeScope = "global"

   Now: 'j' and '?' fire again
```

## Migration from addEventListener

Before:

```tsx
function OldComponent() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'j') selectNext();
      if (e.key === 'k') selectPrev();
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

After:

```tsx
function NewComponent() {
  useKey('j', selectNext);
  useKey('k', selectPrev);
  useKey('Escape', close);
}
```

**Benefits:**
- No manual cleanup
- Input elements auto-bypassed
- Scope blocking works automatically
- Consistent hotkey format across codebase

## File Structure

```
components/keyboard/
  keyboard-provider.tsx   # Context provider, single global listener

hooks/keyboard/
  use-key.ts              # Register hotkey to current scope
  use-scope.ts            # Push blocking scope
  use-navigable-list.ts   # Arrow navigation for lists
  use-keyboard-context.ts # Internal context hook

lib/
  keyboard.ts             # Pure utility functions (matchesHotkey, isInputElement)
```
