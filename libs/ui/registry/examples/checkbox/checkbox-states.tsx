"use client";

import { useState } from "react";
import { Checkbox, CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox";

export default function CheckboxStates() {
  const [highlighted, setHighlighted] = useState<string | null>("react");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Keyboard highlight</div>
        <CheckboxGroup
          label="Stack"
          defaultValue={["typescript"]}
          highlighted={highlighted}
          onHighlightChange={setHighlighted}
        >
          <CheckboxItem value="typescript" label="TypeScript" />
          <CheckboxItem value="react" label="React" />
          <CheckboxItem value="tailwind" label="Tailwind CSS" />
        </CheckboxGroup>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Invalid</div>
        <Checkbox aria-invalid label="Accept terms and conditions" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Disabled group</div>
        <CheckboxGroup label="Stack" defaultValue={["typescript"]} disabled>
          <CheckboxItem value="typescript" label="TypeScript" />
          <CheckboxItem value="react" label="React" />
        </CheckboxGroup>
      </div>
    </div>
  );
}
