import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export default function LabelHorizontal() {
  return (
    <Label label="Enable notifications" orientation="horizontal">
      <Checkbox />
    </Label>
  )
}
