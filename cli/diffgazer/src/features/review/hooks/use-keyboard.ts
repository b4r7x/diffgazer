import { useInput } from "ink";

interface ReviewKeyboardOptions {
  onZoneSwitch: () => void;
  onTabSwitch?: (tab: number) => void;
  onBack: () => void;
}

export function useReviewKeyboard({
  onZoneSwitch,
  onTabSwitch,
  onBack,
}: ReviewKeyboardOptions): void {
  useInput((input, key) => {
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
  });
}
