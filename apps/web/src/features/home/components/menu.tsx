import { isMenuActionDisabled, withGroupDividers } from "@diffgazer/core/navigation";
import type { MenuAction, NavItem } from "@diffgazer/core/schemas/presentation";
import { Menu, MenuDivider, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { Fragment } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";

interface HomeMenuProps {
  highlighted: MenuAction | null;
  onHighlightChange: (id: MenuAction | null) => void;
  onSelect: (id: MenuAction) => void;
  items: NavItem[];
  isTrusted?: boolean;
  hasResumableSession?: boolean;
  /** The row whose review is being created. Null while nothing is starting. */
  pendingAction?: MenuAction | null;
}

const MENU_TITLE_ID = "home-main-menu-title";

/**
 * The row the user pressed becomes the run: the cell that carries [r] on every
 * other row turns into a braille spinner in the run palette the progress screen
 * is about to use, so the start reads where the click landed instead of as a
 * line appended under the menu. The chip is decorative — the menu's live region
 * carries the announcement, and the row keeps its own accessible name.
 */
function StartingRowLabel({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-between gap-4">
      <span className="truncate">{label}</span>
      <Spinner
        aria-hidden="true"
        variant="braille"
        size="sm"
        gap="sm"
        className="shrink-0 uppercase tracking-wide text-status-running"
      >
        Starting
      </Spinner>
    </span>
  );
}

export function HomeMenu({
  highlighted,
  onHighlightChange,
  onSelect,
  items,
  isTrusted = false,
  hasResumableSession = false,
  pendingAction = null,
}: HomeMenuProps) {
  const annotated = withGroupDividers(items);
  const { focusWithin, props: focusWithinProps } = useFocusWithin<HTMLDivElement>();
  const isStartingReview = pendingAction !== null;

  return (
    // The menu is the pane the arrow keys drive, and it autofocuses on mount, so
    // its bracket affordance arrives from real focus instead of a static claim.
    <Panel
      {...focusWithinProps}
      focused={focusWithin}
      aria-labelledby={MENU_TITLE_ID}
      className="flex w-full min-w-0 flex-col lg:flex-1"
    >
      <Panel.Label>
        <h2 id={MENU_TITLE_ID}>Main Menu</h2>
      </Panel.Label>
      {/* Rows run flush at both ends: the tab chip seats over the first row and
          the last row's highlight terminates into the bottom border, matching
          the settings hub. */}
      <div className="flex flex-col">
        <Menu
          highlighted={highlighted}
          onHighlightChange={onHighlightChange}
          onSelect={onSelect}
          aria-labelledby={MENU_TITLE_ID}
          autoFocus
        >
          {annotated.map(({ item, showDividerBefore }) => {
            const isStarting = pendingAction === item.id;
            const disabled = isMenuActionDisabled(item.id, { isTrusted, hasResumableSession });
            return (
              <Fragment key={item.id}>
                {showDividerBefore && <MenuDivider />}
                <MenuItem
                  id={item.id}
                  disabled={disabled}
                  variant={item.variant}
                  // The key is inert while the start runs, so the row stops
                  // advertising it and lends the cell to the run state.
                  hotkey={isStarting ? undefined : item.shortcut}
                  aria-busy={isStarting || undefined}
                  // The working row is not blocked — re-entrancy is refused by
                  // the start handler, not by the menu — so it keeps its normal
                  // painting and only the pointer reports the work in flight.
                  className={isStarting ? "cursor-progress" : undefined}
                >
                  {isStarting ? <StartingRowLabel label={item.label} /> : item.label}
                </MenuItem>
              </Fragment>
            );
          })}
        </Menu>
        {/* Mounted for the whole page rather than with its text: a live region
            inserted in the same commit as its content is skipped by some screen
            reader/browser pairs, and this is the only channel that announces the
            start — the row's spinner chip is decorative. <output> is role=status,
            which already implies aria-live="polite". */}
        <output className="sr-only">{isStartingReview ? "Starting review" : null}</output>
      </div>
    </Panel>
  );
}
