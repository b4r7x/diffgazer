import type { ReactElement } from "react";
import { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { HeaderBrand } from "../../components/ui/header-brand.js";
import { StatusCard } from "../../components/ui/status-card.js";
import { FooterBarWithDivider, type Shortcut } from "../../components/ui/footer-bar.js";
import { useTheme } from "../../hooks/use-theme.js";

export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "settings"
  | "help"
  | "quit";

interface MenuItem {
  key: string;
  label: string;
  action: MenuAction;
  disabled?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: "r", label: "Review unstaged changes", action: "review-unstaged" },
  { key: "R", label: "Review staged changes", action: "review-staged" },
  { key: "f", label: "Review specific files...", action: "review-files" },
  { key: "l", label: "Resume last review", action: "resume-review" },
  { key: "h", label: "History", action: "history" },
  { key: "s", label: "Settings", action: "settings" },
  { key: "?", label: "Help", action: "help" },
  { key: "q", label: "Quit", action: "quit" },
];

const FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "\u2191/\u2193", label: "select" },
  { key: "Enter", label: "open" },
  { key: "q", label: "quit" },
];

interface MainMenuViewProps {
  provider?: string;
  model?: string;
  isTrusted?: boolean;
  lastReviewAt?: string | null;
  hasLastReview?: boolean;
  onSelect?: (action: MenuAction) => void;
  isActive?: boolean;
}

export function MainMenuView({
  provider = "Not configured",
  model,
  isTrusted = false,
  lastReviewAt,
  hasLastReview = false,
  onSelect,
  isActive = true,
}: MainMenuViewProps): ReactElement {
  const { exit } = useApp();
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuItems = MENU_ITEMS.map((item) => ({
    ...item,
    disabled: item.action === "resume-review" && !hasLastReview,
  }));

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.upArrow || input === "k") {
        const newIndex = findPrevEnabled(menuItems, selectedIndex);
        if (newIndex !== -1) setSelectedIndex(newIndex);
        return;
      }

      if (key.downArrow || input === "j") {
        const newIndex = findNextEnabled(menuItems, selectedIndex);
        if (newIndex !== -1) setSelectedIndex(newIndex);
        return;
      }

      if (key.return) {
        const item = menuItems[selectedIndex];
        if (item && !item.disabled) {
          if (item.action === "quit") {
            exit();
          } else {
            onSelect?.(item.action);
          }
        }
        return;
      }

      const matchingItem = menuItems.find((item) => item.key === input);
      if (matchingItem && !matchingItem.disabled) {
        if (matchingItem.action === "quit") {
          exit();
        } else {
          onSelect?.(matchingItem.action);
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" marginTop={1}>
      <HeaderBrand showStars={true} />

      <Box marginTop={1} marginBottom={1}>
        <StatusCard
          provider={provider}
          model={model}
          isTrusted={isTrusted}
          lastReviewAt={lastReviewAt}
        />
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={colors.ui.textMuted}>
          Actions:
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {menuItems.map((item, index) => (
            <Box key={item.key}>
              <Text
                color={selectedIndex === index ? colors.ui.accent : undefined}
                dimColor={item.disabled}
              >
                {selectedIndex === index ? "> " : "  "}
              </Text>
              <Text
                color={selectedIndex === index ? colors.ui.accent : colors.ui.textMuted}
                dimColor={item.disabled}
              >
                [{item.key}]
              </Text>
              <Text dimColor={item.disabled}> {item.label}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      <FooterBarWithDivider shortcuts={FOOTER_SHORTCUTS} />
    </Box>
  );
}

function findNextEnabled(items: MenuItem[], currentIndex: number): number {
  for (let i = currentIndex + 1; i < items.length; i++) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

function findPrevEnabled(items: MenuItem[], currentIndex: number): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}
