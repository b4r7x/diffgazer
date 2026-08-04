import { isMenuActionDisabled, withGroupDividers } from "@diffgazer/core/navigation";
import type { NavItem } from "@diffgazer/core/schemas/presentation";
import { Menu, MenuDivider, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { Fragment } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";

interface HomeMenuProps {
  highlighted: string | null;
  onHighlightChange: (id: string | null) => void;
  onSelect: (id: string) => void;
  items: NavItem[];
  isTrusted?: boolean;
  hasResumableSession?: boolean;
  pending?: boolean;
}

const MENU_TITLE_ID = "home-main-menu-title";

export function HomeMenu({
  highlighted,
  onHighlightChange,
  onSelect,
  items,
  isTrusted = false,
  hasResumableSession = false,
  pending = false,
}: HomeMenuProps) {
  const annotated = withGroupDividers(items);
  const { focusWithin, props: focusWithinProps } = useFocusWithin<HTMLDivElement>();

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
            const disabled =
              pending || isMenuActionDisabled(item.id, { isTrusted, hasResumableSession });
            return (
              <Fragment key={item.id}>
                {showDividerBefore && <MenuDivider />}
                <MenuItem
                  id={item.id}
                  disabled={disabled}
                  variant={item.variant}
                  hotkey={item.shortcut}
                >
                  {item.label}
                </MenuItem>
              </Fragment>
            );
          })}
        </Menu>
        {pending && (
          <Spinner variant="braille" className="text-muted-foreground justify-center py-2">
            Starting review…
          </Spinner>
        )}
      </div>
    </Panel>
  );
}
