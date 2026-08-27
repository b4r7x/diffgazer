import { useInput } from "ink";

interface ReviewKeyboardOptions {
  onZoneSwitch: () => void;
  onPaneCross?: (direction: "left" | "right") => void;
  onTabSwitch?: (tab: number) => void;
  onBack: () => void;
}

export function useReviewKeyboard({
  onZoneSwitch,
  onPaneCross,
  onTabSwitch,
  onBack,
}: ReviewKeyboardOptions): void {
  useInput((input, key) => {
    if (key.tab) {
      onZoneSwitch();
      return;
    }

    if (key.rightArrow) {
      onPaneCross?.("right");
      return;
    }

    if (key.leftArrow) {
      onPaneCross?.("left");
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
