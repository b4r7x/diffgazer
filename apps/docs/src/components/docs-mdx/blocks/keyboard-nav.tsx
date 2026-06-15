import { Typography } from "@diffgazer/ui/components/typography";
import { DemoPreview } from "@/components/demo-preview";
import { useDemos } from "@/hooks/use-demos";
import { resolvePreviewFrame } from "@/lib/example-frames";
import { useComponentData } from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

export function KeyboardNav() {
  const data = useComponentData();
  const library = useCurrentLibrary();
  const demos = useDemos(library);

  if (!data?.docs?.keyboard) return null;
  const { description, examples, keys } = data.docs.keyboard;
  const hasDescription = description.trim().length > 0;
  const hasKeys = keys !== undefined && keys.length > 0;
  const hasExamples = examples.length > 0;

  if (!hasDescription && !hasKeys && !hasExamples) return null;

  return (
    <div>
      <Typography as="h3" size="sm" className="font-bold text-foreground mb-3">
        Keyboard Navigation
      </Typography>
      {hasDescription && (
        <Typography as="p" size="sm" className="mb-4">
          {description}
        </Typography>
      )}
      {hasKeys && (
        <div className="mb-6 overflow-x-auto border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2 text-left font-bold text-foreground">Key</th>
                <th className="px-3 py-2 text-left font-bold text-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((row) => (
                <tr key={row.keys} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-2 align-top font-mono text-xs text-foreground">
                    {row.keys}
                  </td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasExamples && (
        <div className="space-y-6">
          {examples.map((ex) => (
            <DemoPreview
              key={ex.name}
              title={ex.title}
              demo={demos[ex.name] ?? null}
              code={data.exampleSource[ex.name]?.highlighted ?? []}
              rawCode={data.exampleSource[ex.name]?.raw ?? ""}
              frame={resolvePreviewFrame(ex.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
