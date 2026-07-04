import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LabelHorizontal() {
  return (
    <Label label="Notification email" orientation="horizontal">
      <Input type="email" placeholder="alerts@example.com" />
    </Label>
  );
}
