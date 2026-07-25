import { Badge } from "@/components/ui/badge";

export default function BadgeSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge size="xs">XS</Badge>
      <Badge size="sm">SM</Badge>
      <Badge size="md">MD</Badge>
      <Badge size="lg">LG</Badge>
    </div>
  );
}
