import { Progress } from "@/components/ui/progress";

export default function ProgressSizes() {
  return (
    <div className="flex w-64 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          size="sm"
        </span>
        <Progress value={45} size="sm" aria-label="Small progress" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          size="md"
        </span>
        <Progress value={45} size="md" aria-label="Medium progress" />
      </div>
    </div>
  );
}
