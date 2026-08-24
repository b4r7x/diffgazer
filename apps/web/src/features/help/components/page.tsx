import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut, ShortcutContext } from "@diffgazer/core/schemas/presentation";
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
import { Fragment, useEffect, useRef } from "react";
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

interface ShortcutGroup {
  context: ShortcutContext;
  heading: string;
  rows: ShortcutRow[];
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

const SHORTCUT_GROUPS: ShortcutGroup[] = groupShortcutsByContext(SHORTCUTS).map((group) => ({
  context: group.context,
  heading: SHORTCUT_CONTEXT_LABELS[group.context],
  rows: toShortcutRows(group.shortcuts),
}));

/**
 * Splits the groups into the two large-screen columns at the row-count midpoint.
 * CSS multicol would balance by rendered height instead, which strands a short
 * group beside a tall one and hands the break point to the browser; splitting
 * whole groups here keeps every group intact and keeps the DOM order canonical,
 * so the reading order still matches the column-by-column visual order.
 */
function splitIntoColumns(groups: ShortcutGroup[]): [ShortcutGroup[], ShortcutGroup[]] {
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  let placed = 0;
  const breakAfter = groups.findIndex((group) => {
    placed += group.rows.length;
    return placed * 2 >= total;
  });
  return [groups.slice(0, breakAfter + 1), groups.slice(breakAfter + 1)];
}

const [LEADING_GROUPS, TRAILING_GROUPS] = splitIntoColumns(SHORTCUT_GROUPS);

// One rail, one seam per column: the key track is exactly as wide as the
// widest key it holds (the fixed column the TUI derives the same way), every
// keycap sits flush left on the rail the ruled group headings also start from,
// and every description starts on the one straight seam 1rem past the track.
// The headings span both tracks with their rule running to the column's right
// edge, so each group opens on a full-width seam instead of a butt-join.
// Sections, lists and rows all subgrid into the enclosing track, so a group
// never opens a seam of its own while each stays its own list for AT to jump
// between. Below lg every section stacks and subgrids into the one outer
// track, so the rail and the seam stay straight from the gesture rows to the
// last shortcut; at lg the two shortcut stacks sit side by side and each sizes
// its own track.
const OUTER_GRID =
  "grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-6 lg:grid-cols-2 lg:gap-x-10";
const GROUP_COLUMN =
  "col-span-2 grid grid-cols-subgrid content-start gap-y-1.5 lg:col-span-1 lg:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] lg:gap-x-4";
const GROUP_LIST = "col-span-2 grid grid-cols-subgrid gap-y-1.5";
const ROW_GRID = "col-span-2 grid grid-cols-subgrid items-baseline text-sm";
// A coarse-pointer lg viewport is a touch laptop, where the gestures keep the
// full width above the two shortcut stacks and size a track of their own.
const GESTURE_SECTION =
  "col-span-2 hidden grid-cols-subgrid gap-y-1.5 pointer-coarse:grid lg:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] lg:gap-x-4";

function ShortcutColumn({ groups }: { groups: ShortcutGroup[] }) {
  return (
    <div className={GROUP_COLUMN}>
      {groups.map((group) => (
        <Fragment key={group.context}>
          <SectionHeader
            as="h2"
            bordered
            id={`${HELP_TITLE_ID}-${group.context}`}
            className="col-span-2 mt-5 pb-1.5 first:mt-0"
          >
            {group.heading}
          </SectionHeader>
          {/* biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
          <ul
            // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
            role="list"
            aria-labelledby={`${HELP_TITLE_ID}-${group.context}`}
            className={GROUP_LIST}
          >
            {group.rows.map((row) => (
              <li key={`${row.label}:${row.keys.join("+")}`} className={ROW_GRID}>
                <span className="flex flex-wrap gap-1">
                  {row.keys.map((key) => (
                    <Kbd key={key} className="whitespace-nowrap">
                      {key}
                    </Kbd>
                  ))}
                </span>
                <span className="min-w-0 break-words text-muted-foreground">{row.label}</span>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  );
}

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
            the text column by a padded wrapper around it. No ring of its own:
            the Panel reticle around it is the pane's single mark. The top inset
            is the band below, not padding, so the band can stick to it. */}
        <ScrollArea
          ref={scrollRef}
          aria-label="Help content"
          className="min-h-0 flex-1 px-3.5 pb-5 text-sm focus:outline-none"
        >
          {/* The "HELP" chip is absolutely positioned across the panel's top
              border and hangs ~7px inside it, so it is the one thing scrolled
              rows can collide with. The band serves both roles: in flow it is
              the resting inset that holds the first heading clear of the
              overhang, and stuck to the top of the scrollport it is the mask
              rows pass behind instead of through. It paints the panel's
              own background, so the seam only exists while something is under
              it. */}
          <div
            data-slot="help-chip-mask"
            className="sticky top-0 h-5 bg-[var(--panel-bg,var(--background))]"
          />
          {/* The group headings answer "why does j/k do nothing here?": the two
              ↑/↓ rows sit in different contexts, where the difference is the
              point. They are the only headings the sheet needs - the corner chip
              already names it - so the table starts on them. At lg the groups
              fill the empty half of a wide viewport as two hand-placed stacks;
              below that it stays one.

              A phone cannot press any of the shortcuts, so the gesture list
              leads on coarse pointers and the key table becomes the reference
              below it. That lead is DOM order rather than a grid `order`, so the
              reading sequence matches the visual one (WCAG 1.3.2): on a fine
              pointer the gesture section is display:none, which drops it from
              the accessibility tree too, leaving the shortcut table first in
              both orders. It shares this grid rather than owning one, so the
              gesture rows land on the same seam as the keys under them. */}
          <div className={OUTER_GRID}>
            <section className={GESTURE_SECTION}>
              <SectionHeader as="h2" bordered className="col-span-2 pb-1.5">
                Touch Gestures
              </SectionHeader>
              {/* biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
              <ul
                // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
                role="list"
                aria-label="Touch gestures"
                className={GROUP_LIST}
              >
                {TOUCH_GESTURES.map((gesture) => (
                  <li key={gesture.gesture} className={ROW_GRID}>
                    <span className="font-bold">{gesture.gesture}</span>
                    <span className="min-w-0 break-words text-muted-foreground">
                      {gesture.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <ShortcutColumn groups={LEADING_GROUPS} />
            <ShortcutColumn groups={TRAILING_GROUPS} />
          </div>
        </ScrollArea>
      </Panel>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
