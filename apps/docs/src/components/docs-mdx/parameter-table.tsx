import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";

interface Parameter {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string | null;
  description?: string;
}

const badgeClass =
  "px-1.5 py-0.5 border border-border text-2xs text-muted-foreground rounded bg-background font-mono";
const headerClass = `${CHROME_LABEL_CLASS} px-3 pb-2 text-left align-bottom font-normal`;

export function ParameterTable({ params }: { params: Parameter[] }) {
  return (
    <div
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: horizontal overflow must be keyboard reachable.
      tabIndex={0}
    >
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th scope="col" className={headerClass}>
              Name
            </th>
            <th scope="col" className={headerClass}>
              Type
            </th>
            <th scope="col" className={headerClass}>
              Default
            </th>
            <th scope="col" className={headerClass}>
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((param) => (
            <tr key={param.name} className="border-b border-border/60 last:border-b-0">
              <td className="px-3 py-2.5 align-top break-words font-bold text-foreground">
                <span className="flex items-center gap-2">
                  {param.name}
                  {param.required && <span className={badgeClass}>required</span>}
                </span>
              </td>
              <td className="px-3 py-2.5 align-top break-words font-mono text-xs text-info">
                {param.type}
              </td>
              <td className="px-3 py-2.5 align-top break-words font-mono text-xs tabular-nums text-muted-foreground">
                {param.defaultValue ?? "—"}
              </td>
              <td className="px-3 py-2.5 align-top break-words text-muted-foreground">
                {param.description ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
