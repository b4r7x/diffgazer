"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function SwitchControlled() {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="flex items-center gap-3">
      <Switch checked={enabled} onChange={setEnabled} aria-label="Enable review notifications" />
      <span className="text-sm text-muted-foreground">
        Review notifications {enabled ? "enabled" : "disabled"}
      </span>
    </div>
  );
}
