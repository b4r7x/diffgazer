import { Spinner } from "@/components/ui/spinner"

export default function SpinnerSizes() {
  return (
    <div className="flex flex-col gap-4">
      <Spinner size="sm"><span className="text-muted-foreground">Small</span></Spinner>
      <Spinner size="md"><span className="text-muted-foreground">Medium</span></Spinner>
      <Spinner size="lg"><span className="text-muted-foreground">Large</span></Spinner>
    </div>
  )
}
