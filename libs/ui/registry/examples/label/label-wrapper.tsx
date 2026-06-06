import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LabelWrapper() {
  return (
    <Label label="Project Name" color="primary">
      <Input placeholder="my-project" />
    </Label>
  )
}
