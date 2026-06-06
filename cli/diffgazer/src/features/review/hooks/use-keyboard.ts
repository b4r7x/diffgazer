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
      if (input === "j") {
        onIssueNav("down");
        return;
      }
      if (input === "k") {
        onIssueNav("up");
        return;
      }

      if (key.tab) {
        onZoneSwitch();
        return;
      }

      if (input >= "1" && input <= "4") {
        onTabSwitch?.(Number.parseInt(input, 10));
        return;
      }

      if (key.escape) {
        onBack();
        return;
      }
    },
    { isActive },
  );
}
