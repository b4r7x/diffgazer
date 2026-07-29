import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export default function TextareaDefault() {
  return (
    <Field className="w-full max-w-md">
      <Field.Label>Commit message</Field.Label>
      <Field.Control>
        <Textarea
          defaultValue={
            "fix: keep focus above error in field chrome\n\nRing on focus; tint at rest.\n\nScroll to review the full message, or drag the handle below the field to grow it."
          }
        />
      </Field.Control>
      <Field.Description>Scroll inside the field, or drag the handle below it.</Field.Description>
    </Field>
  );
}
