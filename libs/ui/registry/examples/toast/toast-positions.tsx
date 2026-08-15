"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/toast";
import { createToggleGroup } from "@/components/ui/toggle-group";

const ToastPositionGroup = createToggleGroup([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const);

type ToastPositionValue = (typeof ToastPositionGroup.values)[number];

export default function ToastPositions() {
  const [position, setPosition] = useState<ToastPositionValue | null>("bottom-right");

  return (
    <div className="flex flex-col gap-4">
      <ToastPositionGroup label="Toast position" value={position} onChange={setPosition}>
        <ToastPositionGroup.Item value="top-left">Top Left</ToastPositionGroup.Item>
        <ToastPositionGroup.Item value="top-center">Top Center</ToastPositionGroup.Item>
        <ToastPositionGroup.Item value="top-right">Top Right</ToastPositionGroup.Item>
        <ToastPositionGroup.Item value="bottom-left">Bottom Left</ToastPositionGroup.Item>
        <ToastPositionGroup.Item value="bottom-center">Bottom Center</ToastPositionGroup.Item>
        <ToastPositionGroup.Item value="bottom-right">Bottom Right</ToastPositionGroup.Item>
      </ToastPositionGroup>
      <Button
        variant="primary"
        size="sm"
        onClick={() => toast.info("Notification", { message: "Check the selected corner." })}
      >
        Show Toast
      </Button>
      <Toaster position={position ?? "bottom-right"} />
    </div>
  );
}
