"use client";

import { useState } from "react";
import { Switch, type SwitchSize } from "@/components/ui/switch";

const states = [
  { label: "unchecked", checked: false, disabled: false },
  { label: "checked", checked: true, disabled: false },
  { label: "disabled", checked: false, disabled: true },
  { label: "disabled checked", checked: true, disabled: true },
];

function SwitchCell({ size, state }: { size: SwitchSize; state: (typeof states)[number] }) {
  const [checked, setChecked] = useState(state.checked);
  // Enabled rows can be toggled, so their caption and accessible name follow the
  // live value; disabled rows never move and keep their sample caption.
  const liveCaption = checked ? "checked" : "unchecked";
  const caption = state.disabled ? state.label : liveCaption;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Switch
        size={size}
        checked={checked}
        onChange={setChecked}
        disabled={state.disabled}
        aria-label={`${size} ${caption}`}
      />
      <span className="text-2xs font-mono text-muted-foreground">{caption}</span>
    </div>
  );
}

function SwitchRow({ size }: { size: SwitchSize }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground uppercase font-bold">size="{size}"</div>
      <div className="flex flex-wrap items-start gap-6">
        {states.map((state) => (
          <SwitchCell key={state.label} size={size} state={state} />
        ))}
      </div>
    </div>
  );
}

export default function SwitchStates() {
  return (
    <div className="flex flex-col gap-6">
      <SwitchRow size="sm" />
      <SwitchRow size="md" />
    </div>
  );
}
