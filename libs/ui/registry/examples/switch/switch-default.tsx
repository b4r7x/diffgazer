"use client";

import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function SwitchDefault() {
  const [checked, setChecked] = useState(true);
  const labelId = useId();

  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onChange={setChecked} aria-labelledby={labelId} />
      <span id={labelId} className="text-sm">
        Enable notifications
      </span>
    </div>
  );
}
