import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LabelRequired() {
  return (
    <Label label="Email Address" color="primary" required>
      <Input type="email" placeholder="you@example.com" required />
    </Label>
  )
}
