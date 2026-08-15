"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function SwitchControlled() {
  const [enabled, setEnabled] = useState(true);

  return (
    <Switch
      checked={enabled}
      onChange={setEnabled}
      label="Review notifications"
      description={enabled ? "Delivered when a review finishes." : "No notifications are sent."}
    />
  );
}
