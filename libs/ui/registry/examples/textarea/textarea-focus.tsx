import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

// The focus classes are applied statically so the treatment stays visible in a
// screenshot. In real usage `focus:` applies them for you.
const FOCUS_RING = "border-ring ring-1 ring-ring";

export default function TextareaFocus() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Field>
        <Field.Label>Resting</Field.Label>
        <Field.Control>
          <Textarea placeholder="Not focused" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Focused</Field.Label>
        <Field.Control>
          <Textarea className={FOCUS_RING} placeholder="Focused" />
        </Field.Control>
      </Field>
    </div>
  );
}
