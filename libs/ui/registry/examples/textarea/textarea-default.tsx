import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export default function TextareaDefault() {
  return (
    <Field>
      <Field.Label>Label</Field.Label>
      <Field.Control>
        <Textarea placeholder="Enter longer text..." />
      </Field.Control>
    </Field>
  );
}
