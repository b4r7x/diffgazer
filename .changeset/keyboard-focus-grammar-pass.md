---
"@diffgazer/ui": minor
---

Typeahead opt-out, a shared focus-outline contract, and a Tab that stops fighting the trigger.

`Menu` and `NavigationList` take a `typeahead` prop (default `true`). Set
`typeahead={false}` on a list whose screen advertises printable keys as
shortcuts — the list stops buffering characters entirely and every key reaches
your hotkey layer.

Typeahead now only claims a keystroke once the query earns it. Previously
`useListbox` called `preventDefault()` on every printable key while items were
mounted, so a window-level hotkey layer that skips `defaultPrevented` events
(as `KeyboardProvider` from `@diffgazer/keys` does) never saw `/`, `?`, `q`, or
a digit while a list had focus. A key is claimed when its query matched an item,
and while a matched query is being narrowed — including the keystroke that
narrows it to nothing. A first press that matches nothing falls through.
Matching a real item still claims the key, so a list containing "Qwen" still
takes `q` while it is focused; that is what `typeahead={false}` is for.

`Menu` now calls `preventDefault()` on Tab in addition to `onClose()`. A menu is
usually portaled, so "the next tabbable after the menu" is a DOM accident, and
letting native Tab run against the closing tree raced whatever restores focus to
the trigger. Tab now closes the menu and leaves focus where your close handler
puts it — for a popover-hosted menu, the trigger, matching Escape. Users who
want the element after the trigger press Tab twice, the standard idiom.

`focus-outline` and `marker-rail` become public: `@diffgazer/ui/lib/focus-outline`
exports `FOCUS_OUTLINE`, `FOCUS_OUTLINE_INSET`, and `HIGHLIGHT_OUTLINE`, and
`@diffgazer/ui/lib/marker-rail` exports `MARKER_RAIL_BASE`,
`MARKER_RAIL_SELECTED`, and `MARKER_RAIL_ON_INVERTED`. Both were already
installed through the copy path as ride-along items; the package exports let app
code compose the same two marks instead of restating the class strings. Focus
outlines move from `outline-offset-2` to `outline-offset-0` across the library
so the mark hugs the control edge, and `ScrollArea` draws it inset
(`outline-offset-[-2px]`) because a scroll container clips anything outside its
padding box. Fields are out of scope and keep the inset field grammar
(`focus:border-ring` plus `focus:ring-1`).

`CheckboxGroup` accepts `k` wherever it accepts `ArrowUp` and `j` wherever it
accepts `ArrowDown`, joining `Menu`, `NavigationList`, and `RadioGroup`.

