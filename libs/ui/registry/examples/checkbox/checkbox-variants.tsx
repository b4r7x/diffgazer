import { Checkbox } from "@/components/ui/checkbox"

export default function CheckboxVariants() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Checkbox checked={true} label="Variant: x (default)" variant="x" />
        <Checkbox checked={true} label="Variant: bullet" variant="bullet" />
      </div>
      <div className="flex flex-col gap-2">
        <Checkbox label="Small" size="sm" />
        <Checkbox label="Medium (default)" size="md" />
        <Checkbox label="Large" size="lg" />
      </div>
      <Checkbox checked="indeterminate" label="Indeterminate state" />
      <Checkbox disabled label="Disabled checkbox" />
      <Checkbox
        label="With description"
        description="This checkbox has additional descriptive text below the label."
      />
    </div>
  )
}
