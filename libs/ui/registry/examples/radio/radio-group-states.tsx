"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";

export default function RadioGroupStates() {
  const [highlighted, setHighlighted] = useState<string | null>("staging");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Keyboard highlight</div>
        <RadioGroup
          label="Environment"
          defaultValue="development"
          activationMode="manual"
          highlighted={highlighted}
          onHighlightChange={setHighlighted}
        >
          <RadioGroupItem value="development" label="Development" />
          <RadioGroupItem value="staging" label="Staging" />
          <RadioGroupItem value="production" label="Production" />
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Invalid</div>
        <RadioGroup label="Environment" aria-invalid>
          <RadioGroupItem value="development" label="Development" />
          <RadioGroupItem value="staging" label="Staging" />
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Disabled group</div>
        <RadioGroup label="Environment" defaultValue="production" disabled>
          <RadioGroupItem value="staging" label="Staging" />
          <RadioGroupItem value="production" label="Production" />
        </RadioGroup>
      </div>
    </div>
  );
}
