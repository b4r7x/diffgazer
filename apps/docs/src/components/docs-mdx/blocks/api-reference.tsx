import { Typography } from "@diffgazer/ui/components/typography";
import { useComponentData } from "../doc-data-context";
import { PropsTableBlock } from "./props-table";

export function APIReference() {
  const componentData = useComponentData();

  if (!componentData) return null;

  const hasProps = Object.keys(componentData.props).length > 0;
  const dataAttributes = componentData.docs?.dataAttributes ?? [];
  const cssVariables = componentData.docs?.cssVariables ?? [];

  if (!hasProps && dataAttributes.length === 0 && cssVariables.length === 0) return null;

  return (
    <>
      <Typography
        as="h2"
        size="xl"
        id="api-reference"
        className="font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border scroll-mt-16"
      >
        API Reference
      </Typography>
      {hasProps && <PropsTableBlock />}
      {dataAttributes.length > 0 && (
        <ReferenceTable
          title="Data attributes"
          columns={["Attribute", "Applies to", "Values", "Description"]}
          rows={dataAttributes.map((item) => [
            item.attribute,
            item.appliesTo,
            item.values,
            item.description,
          ])}
        />
      )}
      {cssVariables.length > 0 && (
        <ReferenceTable
          title="CSS variables"
          columns={["Name", "Default", "Description"]}
          rows={cssVariables.map((item) => [
            item.name,
            item.defaultValue ?? "component-defined",
            item.description,
          ])}
        />
      )}
    </>
  );
}

function ReferenceTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <Typography
          as="h3"
          size="lg"
          id={title.toLowerCase().replace(/\s+/g, "-")}
          className="font-bold text-foreground scroll-mt-16"
        >
          {title}
        </Typography>
        <span className="h-px bg-border flex-1" />
      </div>
      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-bold text-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("|")} className="border-b border-border/60 last:border-b-0">
                {row.map((cell, index) => (
                  <td
                    key={`${columns[index]}-${cell}`}
                    className={
                      index === 0
                        ? "px-3 py-2 align-top font-mono text-xs text-foreground"
                        : "px-3 py-2 align-top text-muted-foreground"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
