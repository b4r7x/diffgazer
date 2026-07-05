import { ParameterTable } from "@/components/docs-mdx/parameter-table";
import { useHookData } from "../doc-data-context";

export function ReturnsTable() {
  const data = useHookData();
  if (!data?.docs?.returns) return null;

  const { type, description, properties } = data.docs.returns;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="break-words font-mono text-info">{type}</span>
        {description && <span className="text-muted-foreground">{description}</span>}
      </div>
      {properties && properties.length > 0 && <ParameterTable params={properties} />}
    </div>
  );
}
