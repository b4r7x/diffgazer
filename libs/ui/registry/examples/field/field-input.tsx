import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function FieldInput() {
  return (
    <Field invalid required>
      <Field.Label>Email</Field.Label>
      <Field.Control>
        <Input placeholder="you@example.com" />
      </Field.Control>
      <Field.Description>Used for review notifications.</Field.Description>
      <Field.Error>Email is required.</Field.Error>
    </Field>
  )
}
