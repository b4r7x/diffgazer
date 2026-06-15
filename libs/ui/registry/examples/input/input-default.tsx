import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function InputDefault() {
  return (
    <Field>
      <Field.Label>Label</Field.Label>
      <Field.Control>
        <Input placeholder="Enter text..." />
      </Field.Control>
    </Field>
  );
}
