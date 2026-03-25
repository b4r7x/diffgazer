import { useInput } from "ink";

interface ReviewKeyboardOptions {
  onIssueNav: (direction: "up" | "down") => void;
  onZoneSwitch: () => void;
  onTabSwitch?: (tab: number) => void;
  onBack: () => void;
  isActive?: boolean;
}

export function useReviewKeyboard({
  onIssueNav,
  onZoneSwitch,
  onTabSwitch,
  onBack,
  isActive = true,
}: ReviewKeyboardOptions): void {
  useInput(
    (input, key) => {
      // j/k for issue navigation
      if (input === "j") {
        onIssueNav("down");
        return;
      }
      if (input === "k") {
        onIssueNav("up");
        return;
      }

      // Tab for zone switching
      if (key.tab) {
        onZoneSwitch();
        return;
      }

      // 1-4 for tab switching
      if (input >= "1" && input <= "4") {
        onTabSwitch?.(Number.parseInt(input, 10));
        return;
      }

      // Escape for back
      if (key.escape) {
        onBack();
        return;
      }
    },
    { isActive },
  );
}
