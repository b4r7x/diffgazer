import { Input } from "@/components/ui/input"

export default function InputVariants() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Input size="sm" placeholder="Small input" />
      <Input size="md" placeholder="Medium input (default)" />
      <Input size="lg" placeholder="Large input" />
      <Input error placeholder="Error state" />
      <Input disabled placeholder="Disabled input" />
    </div>
  )
}
