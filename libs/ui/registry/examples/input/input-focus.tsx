import { Field } from "@/components/ui/field";
import { Input, InputGroup } from "@/components/ui/input";

// The focus classes are applied statically so the treatment stays visible in a
// screenshot. In real usage `focus:` / `focus-within:` apply them for you.
const FOCUS_RING = "border-ring ring-1 ring-ring";

export default function InputFocus() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Field>
        <Field.Label>Resting</Field.Label>
        <Field.Control>
          <Input placeholder="Not focused" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Focused</Field.Label>
        <Field.Control>
          <Input className={FOCUS_RING} placeholder="Focused" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Focused group</Field.Label>
        <Field.Control>
          <InputGroup className={FOCUS_RING} prefix="~/" suffix=".json" defaultValue="diffgazer" />
        </Field.Control>
      </Field>
    </div>
  );
}
