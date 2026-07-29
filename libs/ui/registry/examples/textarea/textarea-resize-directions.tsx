import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const MESSAGE =
  "refactor: move the hunk list into its own panel\nKeeps the diff view readable on narrow terminals.";

export default function TextareaResizeDirections() {
  return (
    <div className="grid w-full max-w-md gap-6">
      <Field>
        <Field.Label>Vertical (default)</Field.Label>
        <Field.Control>
          <Textarea defaultValue={MESSAGE} />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Horizontal</Field.Label>
        <Field.Control>
          <Textarea resize="horizontal" defaultValue={MESSAGE} />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Both, one handle per edge</Field.Label>
        <Field.Control>
          <Textarea
            resize="both"
            resizeHandle={{ vertical: "box-label", horizontal: "box" }}
            defaultValue={MESSAGE}
          />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Fixed</Field.Label>
        <Field.Control>
          <Textarea resize="none" defaultValue={MESSAGE} />
        </Field.Control>
      </Field>
    </div>
  );
}
