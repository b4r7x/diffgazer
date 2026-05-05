import { Spinner } from "@/components/ui/spinner"

export default function SpinnerDefault() {
  return (
    <div className="flex flex-col gap-6">
      <Spinner />
      <Spinner>
        <span className="text-muted-foreground">Loading...</span>
      </Spinner>
    </div>
  )
}
