"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CheckboxVariants() {
  const [indeterminateChecked, setIndeterminateChecked] = useState<boolean | "indeterminate">(
    "indeterminate",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Indicator</div>
        <Checkbox defaultChecked label="Variant: x (default)" variant="x" />
        <Checkbox
          checked={indeterminateChecked}
          onChange={setIndeterminateChecked}
          label="Indeterminate state"
        />
        <Checkbox defaultChecked label="Variant: bullet" variant="bullet" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Size</div>
        <Checkbox defaultChecked label="Small" size="sm" />
        <Checkbox defaultChecked label="Medium (default)" size="md" />
        <Checkbox defaultChecked label="Large" size="lg" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase font-bold">Content</div>
        <Checkbox disabled label="Disabled checkbox" />
        <Checkbox
          label="With description"
          description="This checkbox has additional descriptive text below the label."
        />
      </div>
    </div>
  );
}
