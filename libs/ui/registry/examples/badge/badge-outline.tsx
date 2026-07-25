import { Badge } from "@/components/ui/badge";

export default function BadgeOutline() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge appearance="outline" variant="success">
        SUCCESS
      </Badge>
      <Badge appearance="outline" variant="warning">
        WARNING
      </Badge>
      <Badge appearance="outline" variant="error">
        ERROR
      </Badge>
      <Badge appearance="outline" variant="info" dot>
        INFO
      </Badge>
      <Badge appearance="outline" size="xs">
        BETA
      </Badge>
    </div>
  );
}
