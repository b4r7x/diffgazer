import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function FieldStates() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
      <Field required>
        <Field.Label>Email (valid)</Field.Label>
        <Field.Control>
          <Input defaultValue="you@example.com" />
        </Field.Control>
        <Field.Description>Used for review notifications.</Field.Description>
      </Field>
      <Field required invalid>
        <Field.Label>Email (invalid)</Field.Label>
        <Field.Control>
          <Input defaultValue="you@" />
        </Field.Control>
        <Field.Description>Used for review notifications.</Field.Description>
        <Field.Error>Enter a full email address.</Field.Error>
      </Field>
      <Field disabled>
        <Field.Label>Workspace</Field.Label>
        <Field.Control>
          <Input defaultValue="diffgazer/main" />
        </Field.Control>
        <Field.Description>Locked while a review is running.</Field.Description>
      </Field>
    </div>
  );
}
