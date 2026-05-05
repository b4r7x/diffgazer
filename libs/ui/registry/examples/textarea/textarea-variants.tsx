import { Textarea } from "@/components/ui/textarea"

export default function TextareaVariants() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Textarea size="sm" placeholder="Small textarea" />
      <Textarea size="md" placeholder="Medium textarea (default)" />
      <Textarea size="lg" placeholder="Large textarea" />
      <Textarea error placeholder="Error state" />
      <Textarea disabled placeholder="Disabled textarea" />
    </div>
  )
}
