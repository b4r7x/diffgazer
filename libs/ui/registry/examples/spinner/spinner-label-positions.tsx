import { Spinner } from "@/components/ui/spinner"

export default function SpinnerLabelPositions() {
  return (
    <div className="flex flex-col gap-6">
      <Spinner labelPosition="right">
        <span className="text-muted-foreground">right</span>
      </Spinner>
      <Spinner labelPosition="left">
        <span className="text-muted-foreground">left</span>
      </Spinner>
      <Spinner labelPosition="bottom">
        <span className="text-muted-foreground">bottom</span>
      </Spinner>
      <Spinner labelPosition="top">
        <span className="text-muted-foreground">top</span>
      </Spinner>
    </div>
  )
}
