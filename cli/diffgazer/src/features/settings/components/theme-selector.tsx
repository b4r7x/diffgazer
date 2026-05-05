import type { ReactElement } from "react";
import { RadioGroup } from "../../../components/ui/radio.js";

interface ThemeSelectorProps {
  value?: string;
  onChange?: (v: string) => void;
  isActive?: boolean;
}

export function ThemeSelector({
  value,
  onChange,
  isActive = true,
}: ThemeSelectorProps): ReactElement {
  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      <RadioGroup.Item
        value="dark"
        label="Dark"
        description="Default dark theme"
      />
      <RadioGroup.Item
        value="light"
        label="Light"
        description="Light theme for bright terminals"
      />
      <RadioGroup.Item
        value="high-contrast"
        label="High Contrast"
        description="Maximum readability"
      />
    </RadioGroup>
  );
}
