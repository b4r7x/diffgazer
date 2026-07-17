"use client";

import { useState } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";

function CustomInput({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
}: {
  id: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const [current, setCurrent] = useControllableState({
    value,
    defaultValue,
    onChange,
  });

  return (
    <input
      id={id}
      name={name}
      className="border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      value={current}
      onChange={(e) => setCurrent(e.target.value)}
    />
  );
}

export default function ControllableStateBasic() {
  const [controlled, setControlled] = useState("hello");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="uncontrolled-input">
          Uncontrolled
        </label>
        <CustomInput id="uncontrolled-input" name="uncontrolled" defaultValue="type here…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="controlled-input">
          Controlled: {controlled}
        </label>
        <CustomInput
          id="controlled-input"
          name="controlled"
          value={controlled}
          onChange={setControlled}
        />
      </div>
    </div>
  );
}
