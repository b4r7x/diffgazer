import { Spinner } from "@/components/ui/spinner"

export default function SpinnerVariants() {
  return (
    <div className="flex flex-col gap-4">
      <Spinner variant="snake"><span className="text-muted-foreground">snake</span></Spinner>
      <Spinner variant="braille"><span className="text-muted-foreground">braille</span></Spinner>
      <Spinner variant="dots"><span className="text-muted-foreground">dots</span></Spinner>
      <Spinner variant="pulse"><span className="text-muted-foreground">pulse</span></Spinner>
    </div>
  )
}
