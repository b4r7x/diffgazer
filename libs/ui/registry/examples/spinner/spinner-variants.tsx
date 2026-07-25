import { Spinner } from "@/components/ui/spinner";

// Every variant animates inside the same em-square glyph box, so the labels
// share one left edge without a compensating grid column — and swapping the
// variant on a live spinner shifts nothing.
export default function SpinnerVariants() {
  return (
    <div className="flex flex-col items-start gap-4">
      <Spinner variant="snake">
        <span className="font-mono text-sm text-muted-foreground">snake</span>
      </Spinner>
      <Spinner variant="braille">
        <span className="font-mono text-sm text-muted-foreground">braille</span>
      </Spinner>
      <Spinner variant="dots">
        <span className="font-mono text-sm text-muted-foreground">dots</span>
      </Spinner>
      <Spinner variant="pulse">
        <span className="font-mono text-sm text-muted-foreground">pulse</span>
      </Spinner>
    </div>
  );
}
