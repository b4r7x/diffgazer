import { Label } from "@/components/ui/label"

export default function LabelColors() {
  return (
    <div className="flex flex-col gap-3">
      <Label color="default">Default</Label>
      <Label color="primary">Primary</Label>
      <Label color="success">Success</Label>
      <Label color="warning">Warning</Label>
      <Label color="error">Error</Label>
    </div>
  )
}
