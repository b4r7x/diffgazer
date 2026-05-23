import { Fragment } from "react";
import { Menu, MenuDivider, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import type { NavItem } from "@diffgazer/core/schemas/presentation";
import { isMenuActionDisabled, withGroupDividers } from "@diffgazer/core/navigation";

interface HomeMenuProps {
  highlighted: string | null;
  onHighlightChange: (id: string | null) => void;
  onSelect: (id: string) => void;
  items: NavItem[];
  isTrusted?: boolean;
  hasResumableSession?: boolean;
}

export function HomeMenu({
  highlighted,
  onHighlightChange,
  onSelect,
  items,
  isTrusted = false,
  hasResumableSession = false,
}: HomeMenuProps) {
  const annotated = withGroupDividers(items);

  return (
    <Panel className="w-full max-w-md lg:w-1/2 lg:max-w-lg h-fit flex flex-col">
      <Panel.Header marker="none">
        <Panel.Title className="text-xs uppercase tracking-widest text-muted text-center w-full font-normal">
          Main Menu
        </Panel.Title>
      </Panel.Header>
      <div className="flex flex-col py-2">
        <Menu
          highlighted={highlighted}
          onHighlightChange={onHighlightChange}
          onSelect={onSelect}
          autoFocus
        >
          {annotated.map(({ item, showDividerBefore }) => {
            const disabled = isMenuActionDisabled(item.id, { isTrusted, hasResumableSession });
            return (
              <Fragment key={item.id}>
                {showDividerBefore && <MenuDivider />}
                <MenuItem id={item.id} disabled={disabled} variant={item.variant}>
                  {item.label}
                </MenuItem>
              </Fragment>
            );
          })}
        </Menu>
      </div>
    </Panel>
  );
}
