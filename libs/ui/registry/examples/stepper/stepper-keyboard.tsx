"use client";

import { useRef, useState } from "react";
import { Stepper } from "@/components/ui/stepper";
// @hidden-imports-ok — demo imports the useNavigation re-export from the hidden use-navigation hook registry item
import { useNavigation } from "@/hooks/use-navigation";

const steps = [
  {
    id: "checkout",
    label: "Checkout repository",
    status: "completed" as const,
    detail: "Cloned main branch at commit a3f8c21.",
  },
  {
    id: "build",
    label: "Build project",
    status: "completed" as const,
    detail: "Compiled 128 modules in 4.7s.",
  },
  {
    id: "test",
    label: "Run test suite",
    status: "active" as const,
    detail: "Executing 87 tests across 12 suites...",
  },
  { id: "deploy", label: "Deploy to staging", status: "pending" as const },
];

export default function StepperKeyboard() {
  const containerRef = useRef<HTMLOListElement>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>(["build"]);

  const { onKeyDown } = useNavigation({
    containerRef,
    role: "button",
    wrap: true,
    moveFocus: true,
    onSelect: (id) =>
      setExpandedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id])),
  });

  return (
    <div className="flex flex-col gap-2">
      <Stepper
        ref={containerRef}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        onKeyDown={onKeyDown}
      >
        {steps.map((step) => (
          <Stepper.Step key={step.id} stepId={step.id} status={step.status}>
            <Stepper.Trigger role="button" data-value={step.id}>
              {step.label}
            </Stepper.Trigger>
            {step.detail && (
              <Stepper.Content>
                <div
                  className={`text-sm ${step.status === "active" ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {step.detail}
                </div>
              </Stepper.Content>
            )}
          </Stepper.Step>
        ))}
      </Stepper>
      <p className="text-xs text-muted-foreground">
        Tab into the list, then ↑↓ to navigate steps · Enter/Space toggles. The focused step draws
        the outside focus ring (2px, --ring, offset 2px) around its whole row.
      </p>
    </div>
  );
}
