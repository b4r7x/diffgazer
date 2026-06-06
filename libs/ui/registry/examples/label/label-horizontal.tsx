import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export default function LabelHorizontal() {
  return (
    <Label label="Enable notifications" orientation="horizontal">
      <Checkbox />
    </Label>
  )
}
