import { Switch } from "@/components/ui/switch";

export default function SwitchDefault() {
  return (
    <Switch
      defaultChecked
      label="Enable notifications"
      description="Delivered when a review finishes."
    />
  );
}
