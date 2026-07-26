"use client";

import { useState } from "react";
import { CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox";

export default function CheckboxChecklist() {
  const [value, setValue] = useState(["setup", "tailwind"]);

  return (
    <CheckboxGroup value={value} onChange={setValue} aria-label="Setup checklist" strikethrough>
      <CheckboxItem value="setup" label="Set up project structure" />
      <CheckboxItem value="typescript" label="Configure TypeScript" />
      <CheckboxItem value="tailwind" label="Add Tailwind CSS" />
      <CheckboxItem value="component" label="Create first component" />
      <CheckboxItem value="tests" label="Write tests" />
    </CheckboxGroup>
  );
}
