import type { ReactElement } from "react";
import { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { HeaderBrand } from "../../components/ui/header-brand.js";
import { StatusCard } from "../../components/ui/status-card.js";
import { FooterBarWithDivider, type Shortcut } from "../../components/ui/footer-bar.js";
import { useTheme } from "../../hooks/use-theme.js";
import { type MenuAction, type MenuItem, MENU_ITEMS, MAIN_MENU_SHORTCUTS } from "@repo/core";
import { findNextEnabled, findPrevEnabled } from "../../lib/list-navigation.js";

export type { MenuAction };

const FOOTER_SHORTCUTS: Shortcut[] = MAIN_MENU_SHORTCUTS.map((s) => ({
  key: s.key,
  label: s.label.toLowerCase(),
}));

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
    disabled: item.id === "resume-review" && !hasLastReview,
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
          if (item.id === "quit") {
            exit();
          } else {
            onSelect?.(item.id);
          }
        }
        return;
      }

      const matchingItem = menuItems.find((item) => item.shortcut === input);
      if (matchingItem && !matchingItem.disabled) {
        if (matchingItem.id === "quit") {
          exit();
        } else {
          onSelect?.(matchingItem.id);
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
            <Box key={item.id}>
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
                [{item.shortcut}]
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
