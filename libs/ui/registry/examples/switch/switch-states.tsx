import { Switch, type SwitchSize } from "@/components/ui/switch";

const states = [
  { label: "unchecked", checked: false, disabled: false },
  { label: "checked", checked: true, disabled: false },
  { label: "disabled", checked: false, disabled: true },
  { label: "disabled checked", checked: true, disabled: true },
];

function SwitchRow({ size }: { size: SwitchSize }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground uppercase font-bold">size="{size}"</div>
      <div className="flex flex-wrap items-start gap-6">
        {states.map((state) => (
          <div key={state.label} className="flex flex-col items-center gap-1.5">
            <Switch
              size={size}
              defaultChecked={state.checked}
              disabled={state.disabled}
              aria-label={`${size} ${state.label}`}
            />
            <span className="text-2xs font-mono text-muted-foreground">{state.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SwitchStates() {
  return (
    <div className="flex flex-col gap-6">
      <SwitchRow size="sm" />
      <SwitchRow size="md" />
    </div>
  );
}
