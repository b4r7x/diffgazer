import { DemoPreview } from "@/components/demo-preview";
import { useDemos } from "@/hooks/use-demos";
import { resolvePreviewFrame } from "@/lib/example-frames";
import { useDocData } from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

export function Example({ name }: { name: string }) {
  const data = useDocData();
  const library = useCurrentLibrary();
  const { demos, isLoading, loadError, retry } = useDemos(library);

  if (!data) return null;
  const d = data.data;
  const src = d.exampleSource?.[name];
  if (!src) {
    throw new Error(`Missing ${library} docs example source: ${name}`);
  }

  return (
    <DemoPreview
      demo={demos[name] ?? null}
      loading={isLoading}
      loadError={loadError}
      onRetryLoad={retry}
      code={src.highlighted}
      rawCode={src.raw}
      frame={resolvePreviewFrame(name)}
    />
  );
}
