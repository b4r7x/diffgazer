import ReactDOM from "react-dom/client";
import { HorizontalStepper } from "../../registry/ui/horizontal-stepper";
import "./horizontal-stepper-constrained.css";

const SETUP_STEPS = [
  { value: "storage", label: "Storage" },
  { value: "provider", label: "Provider" },
  { value: "apikey", label: "API Key" },
  { value: "model", label: "Model" },
  { value: "analysis", label: "Analysis" },
  { value: "execution", label: "Execution" },
] as const;

const SHORT_STEPS = [
  { value: "pick", label: "Pick" },
  { value: "confirm", label: "Confirm" },
  { value: "done", label: "Done" },
] as const;

const LONG_STEPS = Array.from({ length: 12 }, (_, index) => ({
  value: `phase-${index + 1}`,
  label: `Phase ${index + 1}`,
}));

function ConstrainedRun({
  testId,
  label,
  steps,
  value,
}: {
  testId: string;
  label: string;
  steps: ReadonlyArray<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <div
      data-testid={testId}
      className="border border-border p-3"
      style={{ width: "100%", maxWidth: "960px" }}
    >
      <HorizontalStepper value={value} aria-label={label}>
        {steps.map((step) => (
          <HorizontalStepper.Step key={step.value} value={step.value}>
            {step.label}
          </HorizontalStepper.Step>
        ))}
      </HorizontalStepper>
    </div>
  );
}

function HorizontalStepperConstrainedFixture() {
  return (
    <div className="flex flex-col gap-4">
      <ConstrainedRun
        testId="stepper-container"
        label="Setup progress"
        steps={SETUP_STEPS}
        value="apikey"
      />
      {/* Active on the first step: a three-step run that windowed would elide the last step and
          render a "+1" marker, so the never-elides assertion has something to catch. */}
      <ConstrainedRun
        testId="stepper-container-short"
        label="Short run"
        steps={SHORT_STEPS}
        value="pick"
      />
      <ConstrainedRun
        testId="stepper-container-long"
        label="Long run"
        steps={LONG_STEPS}
        value="phase-6"
      />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<HorizontalStepperConstrainedFixture />);
