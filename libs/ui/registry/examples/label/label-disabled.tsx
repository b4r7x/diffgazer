import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function LabelDisabled() {
  return (
    <Label label="Project Name" color="primary">
      <Input placeholder="my-project" disabled />
    </Label>
  )
}
