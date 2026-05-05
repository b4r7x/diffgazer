# Focus Zones

> Try the [Focus Zones demo](../../examples/playground/) to see zones in action.

`useFocusZone` solves a specific problem: the same key should do different things depending on which panel is active.

Think of an IDE layout. Enter in the file sidebar opens a file. Enter in the editor inserts a newline. Enter in the terminal runs a command. Same key, three different handlers. Zones let you express this without manually wiring `if (activePanel === "sidebar")` checks everywhere.

## Basic setup

Define your zones as a union type, list them out, set up transitions, and use `forZone` to scope your key handlers.

```tsx
type Zone = "sidebar" | "content" | "preview";

function ThreePanelLayout() {
  const { zone, forZone, inZone } = useFocusZone<Zone>({
    initial: "sidebar",
    zones: ["sidebar", "content", "preview"],
    transitions: ({ zone, key }) => {
      if (key === "ArrowRight") {
        if (zone === "sidebar") return "content";
        if (zone === "content") return "preview";
      }
      if (key === "ArrowLeft") {
        if (zone === "preview") return "content";
        if (zone === "content") return "sidebar";
      }
      return null; // block movement
    },
    tabCycle: ["sidebar", "content", "preview"],
  });

  // Each useKey only fires when its zone is active
  useKey("Enter", () => openFile(), forZone("sidebar"));
  useKey("Enter", () => editLine(), forZone("content"));
  useKey("Enter", () => runPreview(), forZone("preview"));

  return (
    <div>
      <Sidebar active={inZone("sidebar")} />
      <Content active={inZone("content")} />
      <Preview active={inZone("preview")} />
    </div>
  );
}
```

## forZone + useKey pattern

`forZone` returns a `UseKeyOptions` object that you pass directly as the options argument to `useKey`. Its job is simple: set `enabled` to `true` only when the current zone matches the target.

```ts
forZone("sidebar")
// returns: { enabled: true }   -- when zone is "sidebar"
// returns: { enabled: false }  -- when zone is anything else
```

You can pass extra options as the second argument. `forZone` spreads them and ANDs the `enabled` values:

```ts
forZone("sidebar", { preventDefault: true, enabled: isOpen })
// returns: { preventDefault: true, enabled: zone === "sidebar" && isOpen }
```

This means you can compose conditions naturally:

```tsx
useKey("Enter", handleOpen, forZone("sidebar", { enabled: hasSelection }));
// Enter only fires when: in sidebar zone AND hasSelection is true
```

Without `forZone`, you'd write:

```tsx
useKey("Enter", handleOpen, { enabled: zone === "sidebar" && hasSelection });
```

Same result, but `forZone` reads better when you have many zone-scoped handlers and it's less error-prone when zones are referenced across multiple hooks.

## Transitions

Arrow key transitions define how zones connect spatially. The `transitions` callback receives the current zone and the arrow key pressed, and returns either a zone name or `null`.

```tsx
transitions: ({ zone, key }) => {
  if (zone === "sidebar" && key === "ArrowRight") return "content";
  if (zone === "content" && key === "ArrowLeft") return "sidebar";
  if (zone === "content" && key === "ArrowRight") return "preview";
  if (zone === "preview" && key === "ArrowLeft") return "content";
  return null;
},
```

Returning `null` blocks the movement -- the zone stays where it is. The hook also validates the return value against the `zones` array, so returning a string that isn't in `zones` is treated the same as `null`.

Arrow key listeners are only registered when `transitions` is provided. If you only use `tabCycle` for movement, no arrow key handlers are set up.

## Tab cycling

`tabCycle` defines the order for Tab/Shift+Tab navigation between zones. It's independent of arrow key transitions.

```tsx
useFocusZone({
  initial: "sidebar",
  zones: ["sidebar", "content", "preview"],
  tabCycle: ["sidebar", "content", "preview"],
});
```

Tab moves forward through the array. Shift+Tab moves backward. Both wrap around.

The `tabCycle` array doesn't have to include all zones, and the order doesn't have to match `zones`:

```tsx
// Tab only cycles between sidebar and content, skipping preview
tabCycle: ["sidebar", "content"],

// Or reverse the tab order
tabCycle: ["content", "sidebar"],
```

Tab and Shift+Tab always call `preventDefault` to avoid moving browser focus out of the app.

## Controlled mode

By default, `useFocusZone` manages the active zone internally. Pass `zone` to control it externally.

```tsx
const [activeZone, setActiveZone] = useState<Zone>("sidebar");

const { forZone, inZone } = useFocusZone<Zone>({
  initial: "sidebar", // still needed as a type hint, but zone prop takes precedence
  zones: ["sidebar", "content", "preview"],
  zone: activeZone,
  onZoneChange: setActiveZone,
  transitions: ({ zone, key }) => {
    // ...
  },
});
```

In controlled mode, `setInternalZone` is never called. The hook fires `onZoneChange` and expects you to update the value yourself. If you don't update `zone` in response to `onZoneChange`, the zone won't actually change.

The `setZone` function from the return value also works in controlled mode -- it goes through the same lifecycle callbacks (leave/enter/change) before calling `onZoneChange`.

## Lifecycle callbacks

Three callbacks fire during zone transitions, in this order:

1. `onLeaveZone(currentZone)` -- about to leave the current zone
2. `onEnterZone(nextZone)` -- about to enter the new zone
3. `onZoneChange(nextZone)` -- zone has changed

```tsx
useFocusZone({
  initial: "sidebar",
  zones: ["sidebar", "content", "preview"],
  onLeaveZone: (zone) => saveState(zone),
  onEnterZone: (zone) => restoreState(zone),
  onZoneChange: (zone) => trackAnalytics(zone),
  // ...
});
```

Setting the zone to the same value it already has is a no-op -- none of the callbacks fire.

## Scope integration

The optional `scope` prop activates a @diffgazer/keys scope while the zone hook is active.

```tsx
useFocusZone({
  initial: "sidebar",
  zones: ["sidebar", "content"],
  scope: "layout",
  // ...
});
```

Internally this calls `useScope("layout", { enabled })`. When the zone hook is disabled (via `enabled: false`), the scope is also deactivated.

This is useful when zones live inside a larger scope hierarchy. For example, a three-panel layout might push a `"layout"` scope, and a dialog opened from within it pushes a `"dialog"` scope that shadows the layout's key handlers.

If `scope` is omitted, no scope is pushed.

## Edge cases

**Invalid initial zone**: If `initial` isn't in the `zones` array, you get a `console.error` in development and the hook falls back to `zones[0]`.

**Single zone**: Works fine. Transitions and tab cycling become no-ops since there's nowhere to go.

**Dynamic zones array**: The hook checks `zones.includes(currentZone)` on every render. If the current zone is removed from the array, it falls back to `zones[0]`. This means you can safely add/remove zones without crashing, but the user might get unexpectedly moved.

**Empty tabCycle**: Tab/Shift+Tab handlers are only registered when `tabCycle` is provided and non-empty.

**`inZone` with multiple arguments**: `inZone("sidebar", "content")` returns true if the current zone is either sidebar or content. Useful for shared UI state:

```tsx
const showEditor = inZone("content", "preview");
```
