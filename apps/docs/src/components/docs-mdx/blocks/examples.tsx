import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@diffgazer/ui/components/code-block";
import { Typography } from "@diffgazer/ui/components/typography";
import { CopyButton } from "@/components/copy-button";
import { DemoPreview } from "@/components/demo-preview";
import { useDemos } from "@/hooks/use-demos";
import { resolvePreviewFrame } from "@/lib/example-frames";
import { resolveExamples } from "@/lib/resolve-examples";
import { useDocData } from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

export function Examples({
  skipFirst,
  showHeading,
}: {
  skipFirst?: boolean;
  showHeading?: boolean;
}) {
  const data = useDocData();
  const library = useCurrentLibrary();
  const demos = useDemos(library);

  if (!data) return null;
  const d = data.data;
  const allExamples = resolveExamples(d);
  const examples = skipFirst ? allExamples.slice(1) : allExamples;

  if (examples.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {showHeading && (
        <Typography
          as="h2"
          size="xl"
          id="examples"
          className="font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border scroll-mt-16"
        >
          Examples
        </Typography>
      )}
      {examples.map((ex) => {
        const src = d.exampleSource?.[ex.name];
        if (!src) {
          throw new Error(`Missing ${library} docs example source: ${ex.name}`);
        }
        const demo = demos[ex.name] ?? null;
        if (demo) {
          return (
            <DemoPreview
              key={ex.name}
              title={ex.title}
              demo={demo}
              code={src.highlighted}
              rawCode={src.raw}
              frame={resolvePreviewFrame(ex.name)}
            />
          );
        }
        return (
          <div key={ex.name} className="border border-border rounded-sm overflow-hidden">
            <div className="px-3 py-2 bg-secondary/30 border-b border-border flex items-center justify-between">
              <span className="text-xs font-mono text-foreground font-bold">{ex.title}</span>
              <CopyButton text={src.raw} />
            </div>
            <CodeBlock>
              <CodeBlockContent>
                {src.highlighted.map((line) => (
                  <CodeBlockLine key={line.number} {...line} />
                ))}
              </CodeBlockContent>
            </CodeBlock>
          </div>
        );
      })}
    </div>
  );
}
