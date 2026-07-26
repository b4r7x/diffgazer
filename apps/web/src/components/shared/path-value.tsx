import { cn } from "@diffgazer/ui/lib/utils";

interface PathValueProps {
  value: string;
  className?: string;
}

/**
 * Middle-truncates a filesystem path without a character budget: the leading
 * segments take the ellipsis while the final segment — the repository name, the
 * only part worth reading — always survives. Wrapping mid-word ("diffgazer-w /
 * orkspace") is what a plain `break-all` did at every width.
 *
 * The two segments stay inline-level on purpose. Laying them out as sibling
 * block boxes (flex items) makes the browser serialize a line break between
 * them, so copying the location yielded a two-line path. `max-w-full` on the
 * head keeps it from pushing the container open; the tail moves to the next
 * line instead of being clipped when the head already fills the box.
 */
export function PathValue({ value, className }: PathValueProps) {
  const lastSeparator = value.lastIndexOf("/");
  const head = lastSeparator > 0 ? value.slice(0, lastSeparator) : "";
  const tail = lastSeparator > 0 ? value.slice(lastSeparator) : value;

  return (
    <span className={cn("inline min-w-0 overflow-hidden font-mono", className)} title={value}>
      {head !== "" && <span className="inline-block max-w-full truncate align-bottom">{head}</span>}
      <span>{tail}</span>
    </span>
  );
}
