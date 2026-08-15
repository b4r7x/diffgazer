import type { ComponentDoc } from "@diffgazer/registry";
import { Typography } from "@diffgazer/ui/components/typography";
import { DemoPreview } from "@/components/demo-preview";
import { useDemos } from "@/hooks/use-demos";
import { resolvePreviewFrame } from "@/lib/example-frames";
import { useComponentData } from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

type KeyboardSection = NonNullable<ComponentDoc["keyboard"]>;

/** Single source of truth for whether the keyboard section renders anything. */
export function hasKeyboardNavContent(
  keyboard: ComponentDoc["keyboard"],
): keyboard is KeyboardSection {
  if (!keyboard) return false;
  return (
    keyboard.description.trim().length > 0 ||
    (keyboard.keys?.length ?? 0) > 0 ||
    keyboard.examples.length > 0
  );
}

export function KeyboardNav() {
  const data = useComponentData();
  const library = useCurrentLibrary();
  const { demos, isLoading, loadError, retry } = useDemos(library);

  const keyboard = data?.docs?.keyboard;
  if (!data || !hasKeyboardNavContent(keyboard)) return null;

  const { description, examples, keys } = keyboard;
  const hasDescription = description.trim().length > 0;
  const hasKeys = keys !== undefined && keys.length > 0;
  const hasExamples = examples.length > 0;

  return (
    <div>
      <Typography as="h3" size="sm" className="font-bold text-foreground mb-3">
        Keyboard Navigation
      </Typography>
      {hasDescription && (
        <Typography as="p" size="sm" className="mb-4 break-words">
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
          {examples.map((ex) => {
            const source = data.exampleSource[ex.name];
            if (!source) {
              throw new Error(`Missing ${library} docs example source: ${ex.name}`);
            }
            return (
              <DemoPreview
                key={ex.name}
                title={ex.title}
                demo={demos[ex.name] ?? null}
                loading={isLoading}
                loadError={loadError}
                onRetryLoad={retry}
                code={source.highlighted}
                rawCode={source.raw}
                frame={resolvePreviewFrame(ex.name)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
