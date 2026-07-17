import { Typography } from "@diffgazer/ui/components/typography";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { useComponentData } from "../doc-data-context";
import { SectionHeading } from "../section-heading";
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
      <SectionHeading id="api-reference">API Reference</SectionHeading>
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
  const headingId = title.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="mt-8">
      <Typography
        as="h3"
        size="sm"
        id={headingId}
        className="mb-3 font-bold text-foreground scroll-mt-16"
      >
        {title}
      </Typography>
      <section
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-labelledby={headingId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: horizontal overflow must be keyboard reachable.
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60">
              {columns.map((column) => (
                <th
                  key={column}
                  className={`${CHROME_LABEL_CLASS} px-3 pb-2 text-left align-bottom font-normal`}
                >
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
                        ? "px-3 py-2.5 align-top break-words font-mono text-xs text-foreground"
                        : "px-3 py-2.5 align-top break-words text-muted-foreground"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
