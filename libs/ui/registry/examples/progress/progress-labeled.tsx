"use client";

import { useId } from "react";
import { Progress } from "@/components/ui/progress";

export default function ProgressLabeled() {
  const labelId = useId();

  return (
    <div className="flex w-72 flex-col gap-1.5">
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span id={labelId} className="text-foreground">
          Uploading diffs
        </span>
        <span className="text-muted-foreground">3/5</span>
      </div>
      <Progress value={3} max={5} aria-labelledby={labelId} valueText="3 of 5 diffs uploaded" />
    </div>
  );
}
