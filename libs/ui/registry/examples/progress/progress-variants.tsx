import { Progress } from "@/components/ui/progress";

export default function ProgressVariants() {
  return (
    <div className="flex w-64 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          variant="cells" (default)
        </span>
        <Progress value={45} aria-label="Cell progress" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          variant="bar"
        </span>
        <Progress value={45} variant="bar" aria-label="Bar progress" />
      </div>
    </div>
  );
}
