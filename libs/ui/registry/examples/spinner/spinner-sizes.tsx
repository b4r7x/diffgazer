import { Spinner } from "@/components/ui/spinner";

export default function SpinnerSizes() {
  return (
    <div className="grid grid-cols-[2rem_auto] items-center justify-start gap-x-3 gap-y-4">
      <Spinner size="sm" />
      <span className="font-mono text-xs text-muted-foreground">sm</span>
      <Spinner size="md" />
      <span className="font-mono text-sm text-muted-foreground">md</span>
      <Spinner size="lg" />
      <span className="font-mono text-base text-muted-foreground">lg</span>
    </div>
  );
}
