import { Fragment } from "react";
import { Menu, MenuDivider, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel, PanelHeader } from "@diffgazer/ui/components/panel";
import type { NavItem } from "@diffgazer/core/schemas/ui";
import { isMenuActionDisabled, withGroupDividers } from "@diffgazer/core/navigation";

interface HomeMenuProps {
  highlighted: string | null;
  onHighlightChange: (id: string | null) => void;
  onSelect: (id: string) => void;
  items: NavItem[];
  isTrusted?: boolean;
  hasLastReview?: boolean;
}

export function HomeMenu({
  highlighted,
  onHighlightChange,
  onSelect,
  items,
  isTrusted = false,
  hasLastReview = false,
}: HomeMenuProps) {
  const annotated = withGroupDividers(items);

  return (
    <Panel className="w-full max-w-md lg:w-1/2 lg:max-w-lg h-fit flex flex-col">
      <PanelHeader variant="subtle">Main Menu</PanelHeader>
      <div className="flex flex-col py-2">
        <Menu
          highlighted={highlighted}
          onHighlightChange={onHighlightChange}
          onSelect={onSelect}
          autoFocus
        >
          {annotated.map(({ item, showDividerBefore }) => {
            const disabled = isMenuActionDisabled(item.id, { isTrusted, hasLastReview });
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
