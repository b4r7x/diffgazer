import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUTS, HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useNavigate } from "@tanstack/react-router";

// "h → History" is a web-only live binding, so it stays appended here per F-242
// per-surface-extras scoping.
const SHORTCUTS = [...HELP_SHORTCUTS, { key: "h", label: "Open History" }];

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
 * The canonical table in libs/core lists one row per key, so scrolling arrives
 * as three consecutive rows all labelled "Scroll Content". Collapsing runs of
 * the same label keeps that shared table the single source of truth while the
 * screen shows one row per action.
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

const SHORTCUT_ROWS = toShortcutRows(SHORTCUTS);

// One grid for the whole list, with each row a subgrid, so every description
// starts on the same column instead of wherever its key chip happens to end —
// the fixed key column the TUI computes from the widest key. Below sm the
// column is capped to a single chip so the multi-key scroll row wraps instead
// of pushing every description into a three-word ribbon.
const LIST_GRID =
  "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)]";
const ROW_GRID = "col-span-2 grid grid-cols-subgrid items-baseline text-sm";

export function HelpPage() {
  const navigate = useNavigate();

  useScope("help");
  useKey("Escape", () => navigate({ to: "/" }));
  usePageFooter({ shortcuts: BACK_SHORTCUTS });

  return (
    <ScrollArea className="flex min-h-0 flex-1 flex-col px-4 pt-8 pb-4">
      <Panel
        frame="viewfinder"
        density="compact"
        aria-labelledby={HELP_TITLE_ID}
        className="mx-auto w-full max-w-2xl"
      >
        <Panel.Label>
          <h1 id={HELP_TITLE_ID}>Help</h1>
        </Panel.Label>
        <Panel.Content>
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
              {/* biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
              <ul
                // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
                role="list"
                aria-label="Keyboard shortcuts"
                className={LIST_GRID}
              >
                {SHORTCUT_ROWS.map((row) => (
                  <li key={`${row.label}:${row.keys.join("+")}`} className={ROW_GRID}>
                    <span className="flex flex-wrap gap-1">
                      {row.keys.map((key) => (
                        <Kbd key={key} className="h-auto whitespace-nowrap">
                          {key}
                        </Kbd>
                      ))}
                    </span>
                    <span className="min-w-0 break-words text-muted-foreground">{row.label}</span>
                  </li>
                ))}
              </ul>
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
        </Panel.Content>
      </Panel>
    </ScrollArea>
  );
}
