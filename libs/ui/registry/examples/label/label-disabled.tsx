import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LabelDisabled() {
  return (
    <Label label="Project Name" color="primary">
      <Input placeholder="my-project" disabled />
    </Label>
  )
}
