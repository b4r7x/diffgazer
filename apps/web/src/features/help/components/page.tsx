import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  BACK_SHORTCUTS,
  groupShortcutsByContext,
  HELP_SHORTCUTS,
  SHORTCUT_CONTEXT_LABELS,
} from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { performBackAction, resolveBackAction } from "@/lib/back-navigation";

// "h → History" and the home sidebar jumps (o/t/p) are web-only live bindings,
// so they stay appended here under per-surface-extras scoping.
const SHORTCUTS: Shortcut[] = [
  ...HELP_SHORTCUTS,
  { key: "h", label: "Open History", context: "global" },
  { key: "o", label: "Open Last Run", context: "home" },
  { key: "t", label: "Grant Trust Permissions", context: "home" },
  { key: "p", label: "Open Provider Settings", context: "home" },
];

const TOUCH_GESTURES = [
  { gesture: "Tap", label: "Open the focused card or menu item" },
  { gesture: "Swipe", label: "Scroll content up and down" },
  { gesture: "Back", label: "Return using the on-screen Back control" },
];

const HELP_TITLE_ID = "help-panel-title";

interface ShortcutRow {
  label: string;
  keys: string[];
}

/**
 * The canonical table in libs/core lists one row per key, so keys that share an
 * action arrive as consecutive rows with the same label ("Move the highlight"
 * for both ↑/↓ and j/k). Collapsing runs of the same label keeps that shared
 * table the single source of truth while the screen shows one row per action.
 * The collapse runs per group, so a label run never merges across a context
 * boundary.
 */
function toShortcutRows(shortcuts: readonly Shortcut[]): ShortcutRow[] {
  const rows: ShortcutRow[] = [];
  for (const { key, label } of shortcuts) {
    const previous = rows.at(-1);
    if (previous?.label === label) previous.keys.push(key);
    else rows.push({ label, keys: [key] });
  }
  return rows;
}

const SHORTCUT_GROUPS = groupShortcutsByContext(SHORTCUTS).map((group) => ({
  context: group.context,
  heading: SHORTCUT_CONTEXT_LABELS[group.context],
  rows: toShortcutRows(group.shortcuts),
}));

// One grid for the whole list, with each row a subgrid, so every description
// starts on the same column instead of wherever its key chip happens to end —
// the fixed key column the TUI computes from the widest key. Below sm the
// column is capped to a single chip so the multi-key scroll row wraps instead
// of pushing every description into a three-word ribbon.
const LIST_GRID =
  "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)]";
// Each context group is its own list (so AT can jump group to group), which
// also makes each one its own grid. A fixed key column therefore replaces the
// `auto` track used by the single gesture list: only a fixed track keeps the
// description column aligned across separate grids, and it is the same fixed
// key column the TUI derives from its widest key.
const SHORTCUT_GRID =
  "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-[13rem_minmax(0,1fr)]";
const ROW_GRID = "col-span-2 grid grid-cols-subgrid items-baseline text-sm";

export function HelpPage() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const { focusWithin, props: focusProps } = useFocusWithin<HTMLDivElement>();

  useScope("help");
  // The footer advertises "Esc Back", so Escape must mirror the header's
  // ← Back: return to the screen help was opened from, with "/" only as the
  // no-history fallback.
  useKey("Escape", () => performBackAction(router, resolveBackAction(pathname, canGoBack)));
  usePageFooter({ shortcuts: BACK_SHORTCUTS });

  // Focus the scroll region on mount so the screen opens with a real focus
  // home instead of document.body: the app shell is overflow-hidden, so arrows
  // on body scroll nothing and an overflowing shortcut table would be
  // keyboard-unreachable on the very screen that documents the keyboard
  // contract. The labelled ScrollArea owns Arrow/Page/Home/End scrolling.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:p-6 lg:p-8">
      <div aria-hidden className="grow" />
      <Panel
        {...focusProps}
        focused={focusWithin}
        density="compact"
        aria-labelledby={HELP_TITLE_ID}
        className="mx-auto flex min-h-0 w-full max-w-2xl flex-col shadow-2xl lg:max-w-3xl"
      >
        <Panel.Label>
          <h1 id={HELP_TITLE_ID}>Help</h1>
        </Panel.Label>
        {/* Direct Panel child carrying the pane padding itself, so the 6px
            scrollbar rides the pane's inner edge instead of being carved out of
            the text column by a padded wrapper around it. text-sm carries the
            base that wrapper set; the colour comes from --panel-fg. No ring of
            its own: the Panel reticle around it is the pane's single mark. */}
        <ScrollArea
          ref={scrollRef}
          aria-label="Help content"
          className="min-h-0 flex-1 px-3.5 py-2.5 text-sm focus:outline-none"
        >
          {/* A phone cannot press any of the shortcuts, so the gesture list leads
            on coarse pointers and the key table becomes the reference below it.
            That lead is DOM order rather than a flex `order`, so the reading
            sequence matches the visual one (WCAG 1.3.2): on a fine pointer the
            gesture section is display:none, which drops it from the accessibility
            tree too, leaving the shortcut table first in both orders. */}
          <div className="flex flex-col gap-6 pt-2">
            <section className="hidden pointer-coarse:block">
              <SectionHeader as="h2" variant="muted" className="mb-3">
                Touch Gestures
              </SectionHeader>
              {/* biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
              <ul
                // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
                role="list"
                aria-label="Touch gestures"
                className={LIST_GRID}
              >
                {TOUCH_GESTURES.map((gesture) => (
                  <li key={gesture.gesture} className={ROW_GRID}>
                    <span className="font-bold text-foreground">{gesture.gesture}</span>
                    <span className="min-w-0 break-words text-muted-foreground">
                      {gesture.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionHeader as="h2" variant="muted" className="mb-3">
                Keyboard Shortcuts
              </SectionHeader>
              {/* The groups answer "why does j/k do nothing here?": the two ↑/↓
                rows sit in different contexts, where the difference is the
                point. At lg they flow into two columns to use the empty half
                of a 1440-wide viewport; below that it stays one column. */}
              <div className="lg:columns-2 lg:gap-x-10">
                {SHORTCUT_GROUPS.map((group) => (
                  <div
                    key={group.context}
                    className="mt-4 break-inside-avoid first:mt-0 lg:mb-4 lg:mt-0"
                  >
                    <SectionHeader
                      as="h3"
                      variant="muted"
                      id={`${HELP_TITLE_ID}-${group.context}`}
                      className="mb-1"
                    >
                      {group.heading}
                    </SectionHeader>
                    {/* biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
                    <ul
                      // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
                      role="list"
                      aria-labelledby={`${HELP_TITLE_ID}-${group.context}`}
                      className={SHORTCUT_GRID}
                    >
                      {group.rows.map((row) => (
                        <li key={`${row.label}:${row.keys.join("+")}`} className={ROW_GRID}>
                          <span className="flex flex-wrap gap-1">
                            {row.keys.map((key) => (
                              <Kbd key={key} className="h-auto whitespace-nowrap">
                                {key}
                              </Kbd>
                            ))}
                          </span>
                          <span className="min-w-0 break-words text-muted-foreground">
                            {row.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader as="h2" variant="muted" className="mb-3">
                About
              </SectionHeader>
              <p className="text-sm text-muted-foreground">
                diffgazer — Local-only AI code review, in your browser and your terminal.
              </p>
            </section>
          </div>
        </ScrollArea>
      </Panel>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
