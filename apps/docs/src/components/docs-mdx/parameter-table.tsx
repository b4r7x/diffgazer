import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
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

export function ParameterTable({ params, label }: { params: Parameter[]; label: string }) {
  return (
    <ScrollArea orientation="horizontal" aria-label={label}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th scope="col" className={`${headerClass} min-w-28`}>
              Name
            </th>
            <th scope="col" className={`${headerClass} min-w-32`}>
              Type
            </th>
            <th scope="col" className={`${headerClass} min-w-20`}>
              Default
            </th>
            <th scope="col" className={`${headerClass} min-w-[14rem]`}>
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
    </ScrollArea>
  );
}
