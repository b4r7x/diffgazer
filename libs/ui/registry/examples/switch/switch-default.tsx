"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function SwitchDefault() {
  const [checked, setChecked] = useState(true);

  return (
    <Switch
      checked={checked}
      onChange={setChecked}
      label="Enable notifications"
      description="Delivered when a review finishes."
    />
  );
}
