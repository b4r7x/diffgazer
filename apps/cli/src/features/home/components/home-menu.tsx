import { Fragment } from "react";
import { useTheme } from "../../../theme/theme-context.js";
import { Menu } from "../../../components/ui/menu.js";
import { MENU_ITEMS } from "../../../config/navigation.js";

interface HomeMenuProps {
  isActive?: boolean;
  onAction: (action: string) => void;
  disableReview?: boolean;
}

export function HomeMenu({
  isActive = true,
  onAction,
  disableReview = false,
}: HomeMenuProps) {
  const { tokens } = useTheme();

  let lastGroup: string | undefined;

  return (
    <Menu isActive={isActive} onSelect={onAction}>
      {MENU_ITEMS.map((item) => {
        const showDivider = lastGroup !== undefined && lastGroup !== item.group;
        lastGroup = item.group;

        const isReviewAction =
          item.id === "review-unstaged" ||
          item.id === "review-staged" ||
          item.id === "resume-review";

        const disabled = disableReview && isReviewAction;

        return (
          <Fragment key={item.id}>
            {showDivider && <Menu.Divider />}
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
  );
}
