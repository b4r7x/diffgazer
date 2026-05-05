import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function LabelWrapper() {
  return (
    <Label label="Project Name" color="primary">
      <Input placeholder="my-project" />
    </Label>
  )
}
