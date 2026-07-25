import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function FieldControls() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Field>
        <Field.Label>Merge when all checks pass</Field.Label>
        <Field.Control>
          <Checkbox defaultChecked />
        </Field.Control>
        <Field.Description>Clicking the label toggles the checkbox.</Field.Description>
      </Field>
      <Field required>
        <Field.Label>Base branch</Field.Label>
        <Field.Control>
          <Select defaultValue="main">
            <SelectTrigger>
              <SelectValue placeholder="Select a branch..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main</SelectItem>
              <SelectItem value="develop">develop</SelectItem>
              <SelectItem value="release/v2">release/v2</SelectItem>
            </SelectContent>
          </Select>
        </Field.Control>
        <Field.Description>Reviews compare against this branch.</Field.Description>
      </Field>
    </div>
  );
}
