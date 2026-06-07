"use client";

import { Progress } from "@/components/ui/progress";

export default function ProgressDefault() {
  return (
    <div className="flex flex-col gap-4 w-64">
      <Progress value={60} aria-label="Upload progress" />
      <Progress aria-label="Loading" />
    </div>
  );
}
