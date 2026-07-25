import { Badge } from "@/components/ui/badge";

export default function BadgeVariants() {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold text-muted-foreground uppercase">Solid</div>
      <div className="flex flex-wrap gap-3">
        <Badge variant="success">SUCCESS</Badge>
        <Badge variant="warning">WARNING</Badge>
        <Badge variant="error">ERROR</Badge>
        <Badge variant="info">INFO</Badge>
        <Badge variant="neutral">NEUTRAL</Badge>
      </div>

      <div className="mt-2 text-xs font-bold text-muted-foreground uppercase">With Dot</div>
      <div className="flex flex-wrap gap-3">
        <Badge variant="success" dot>
          SUCCESS
        </Badge>
        <Badge variant="warning" dot>
          WARNING
        </Badge>
        <Badge variant="error" dot>
          ERROR
        </Badge>
        <Badge variant="info" dot>
          INFO
        </Badge>
        <Badge variant="neutral" dot>
          NEUTRAL
        </Badge>
      </div>
    </div>
  );
}
