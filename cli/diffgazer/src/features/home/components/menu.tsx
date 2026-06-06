import { isMenuActionDisabled, withGroupDividers } from "@diffgazer/core/navigation";
import { MENU_ITEMS } from "@diffgazer/core/schemas/presentation";
import { Fragment } from "react";
import { Menu } from "../../../components/ui/menu";
import { Panel } from "../../../components/ui/panel";

interface HomeMenuProps {
  isActive?: boolean;
  onAction: (action: string) => void;
  isTrusted?: boolean;
  hasResumableSession?: boolean;
}

export function HomeMenu({
  isActive = true,
  onAction,
  isTrusted = false,
  hasResumableSession = false,
}: HomeMenuProps) {
  const annotated = withGroupDividers(MENU_ITEMS);

  return (
    <Panel>
      <Panel.Header variant="subtle">Main Menu</Panel.Header>
      <Panel.Content>
        <Menu isActive={isActive} onSelect={onAction}>
          {annotated.map(({ item, showDividerBefore }) => {
            const disabled = isMenuActionDisabled(item.id, { isTrusted, hasResumableSession });
            return (
              <Fragment key={item.id}>
                {showDividerBefore && <Menu.Divider />}
                <Menu.Item
                  id={item.id}
                  hotkey={item.shortcut}
                  variant={item.variant}
                  disabled={disabled}
                >
                  {item.label}
                </Menu.Item>
              </Fragment>
            );
          })}
        </Menu>
      </Panel.Content>
    </Panel>
  );
}
