import { cn } from "@diffgazer/ui/lib/utils";

interface PathValueProps {
  value: string;
  className?: string;
}

/**
 * Middle-truncates a filesystem path without a character budget: the leading
 * segments take the ellipsis while the final segment — the repository name, the
 * only part worth reading — always survives. Wrapping mid-word ("diffgazer-w /
 * orkspace") is what a plain `break-all` did at every width. A last segment
 * wider than the box clips there rather than pushing its container open.
 */
export function PathValue({ value, className }: PathValueProps) {
  const lastSeparator = value.lastIndexOf("/");
  const head = lastSeparator > 0 ? value.slice(0, lastSeparator) : "";
  const tail = lastSeparator > 0 ? value.slice(lastSeparator) : value;

  return (
    <span className={cn("flex min-w-0 overflow-hidden font-mono", className)} title={value}>
      {head !== "" && <span className="truncate">{head}</span>}
      <span className="shrink-0">{tail}</span>
    </span>
  );
}
