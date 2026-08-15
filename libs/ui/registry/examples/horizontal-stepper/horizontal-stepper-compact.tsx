import type { ReactNode } from "react";
import { HorizontalStepper } from "@/components/ui/horizontal-stepper";

const SETUP_STEPS = [
  { value: "storage", label: "Storage" },
  { value: "provider", label: "Provider" },
  { value: "apikey", label: "API Key" },
  { value: "model", label: "Model" },
  { value: "analysis", label: "Analysis" },
  { value: "execution", label: "Execution" },
];

function SetupStepper({ compact }: { compact?: boolean }) {
  return (
    <HorizontalStepper value="apikey" compact={compact} aria-label="Setup progress">
      {SETUP_STEPS.map(({ value, label }) => (
        <HorizontalStepper.Step key={value} value={value}>
          {label}
        </HorizontalStepper.Step>
      ))}
    </HorizontalStepper>
  );
}

function Demo({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">{caption}</p>
      {children}
    </div>
  );
}

export default function HorizontalStepperCompact() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Demo caption="Wide container — full stepper">
        <div className="border border-border p-3">
          <SetupStepper />
        </div>
      </Demo>

      <Demo caption="Constrained to 380px — connectors and inactive labels drop out">
        <div className="max-w-[380px] border border-border p-3">
          <SetupStepper />
        </div>
      </Demo>

      <Demo caption="Constrained to 280px — the run windows to previous/active/next with +N counters">
        <div className="max-w-[280px] border border-border p-3">
          <SetupStepper />
        </div>
      </Demo>

      <Demo caption="Constrained to 200px — only the active step is left, glyph included">
        <div className="max-w-[200px] border border-border p-3">
          <SetupStepper />
        </div>
      </Demo>

      <Demo caption="compact — forced at any width">
        <div className="border border-border p-3">
          <SetupStepper compact />
        </div>
      </Demo>
    </div>
  );
}
