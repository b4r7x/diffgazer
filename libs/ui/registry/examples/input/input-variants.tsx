import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function InputVariants() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Field>
        <Field.Label>Small</Field.Label>
        <Field.Control>
          <Input size="sm" placeholder="Small input" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Medium (default)</Field.Label>
        <Field.Control>
          <Input size="md" placeholder="Medium input (default)" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Large</Field.Label>
        <Field.Control>
          <Input size="lg" placeholder="Large input" />
        </Field.Control>
      </Field>
      <Field invalid>
        <Field.Label>Error state</Field.Label>
        <Field.Control>
          <Input placeholder="Error state" />
        </Field.Control>
      </Field>
      <Field disabled>
        <Field.Label>Disabled</Field.Label>
        <Field.Control>
          <Input placeholder="Disabled input" />
        </Field.Control>
      </Field>
    </div>
  );
}
