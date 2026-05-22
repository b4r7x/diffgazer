import { Spinner } from "@/components/ui/spinner/spinner"

export function ContentSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner variant="braille" size="md">loading...</Spinner>
    </div>
  )
}
