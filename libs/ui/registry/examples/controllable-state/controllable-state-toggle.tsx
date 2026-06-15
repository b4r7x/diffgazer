"use client";

import { useState } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";

function Toggle({
  pressed,
  defaultPressed = false,
  onPressedChange,
  children,
}: {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  children: React.ReactNode;
}) {
  const [isPressed, setIsPressed] = useControllableState({
    value: pressed,
    defaultValue: defaultPressed,
    onChange: onPressedChange,
  });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPressed}
      className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors ${
        isPressed
          ? "border-success-border bg-success-subtle text-success-text"
          : "border-border bg-background text-muted-foreground"
      }`}
      onClick={() => setIsPressed((prev) => !prev)}
    >
      <span className="text-xs">{isPressed ? "ON" : "OFF"}</span>
      {children}
    </button>
  );
}

export default function ControllableStateToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Uncontrolled</span>
        <Toggle>Notifications</Toggle>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Controlled: {enabled ? "on" : "off"}</span>
        <Toggle pressed={enabled} onPressedChange={setEnabled}>
          Dark mode
        </Toggle>
      </div>
    </div>
  );
}
