import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export default function TextareaVariants() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Field>
        <Field.Label>Small</Field.Label>
        <Field.Control>
          <Textarea size="sm" placeholder="Small textarea" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Medium (default)</Field.Label>
        <Field.Control>
          <Textarea size="md" placeholder="Medium textarea (default)" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Large</Field.Label>
        <Field.Control>
          <Textarea size="lg" placeholder="Large textarea" />
        </Field.Control>
      </Field>
      <Field invalid>
        <Field.Label>Error state</Field.Label>
        <Field.Control>
          <Textarea placeholder="Error state" />
        </Field.Control>
      </Field>
      <Field disabled>
        <Field.Label>Disabled</Field.Label>
        <Field.Control>
          <Textarea placeholder="Disabled textarea" />
        </Field.Control>
      </Field>
    </div>
  );
}
