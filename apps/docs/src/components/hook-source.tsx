import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { type HookData, type HookDataMap, hooksData } from "@/lib/generated-doc-data";
import { hookSourceFiles } from "@/lib/library";
import { CopyButton } from "./copy-button";
import { SourceViewer } from "./docs-mdx/source-viewer";

interface HookSourceProps {
  library: string;
  hook: string;
}

export function HookSource({ library, hook }: HookSourceProps) {
  const data: HookDataMap = hooksData[library] ?? {};
  const entry = data[hook];

  if (!entry) return null;

  return (
    <div className="space-y-6">
      <HookSourceBlock hook={entry} />
    </div>
  );
}

function HookSourceBlock({ hook }: { hook: HookData }) {
  const files = hookSourceFiles(hook.name, hook);
  const isSingleFile = files.length === 1;

  return (
    <SourceViewer
      files={files}
      triggerLabel={
        <span className="font-bold">
          {isSingleFile ? files[0]?.path : `${hook.title} source (${files.length} files)`}
        </span>
      }
      description={hook.description}
      copyButton={
        isSingleFile ? (
          <CopyButton text={files[0]?.raw ?? ""} label={`Copy ${hook.title}`} />
        ) : undefined
      }
      showHeading={false}
    />
  );
}

interface LibraryHookSourceProps {
  library: string;
  sectionTitle: string;
  hint: React.ReactNode;
}

export function LibraryHookSource({ library, sectionTitle, hint }: LibraryHookSourceProps) {
  const entries = Object.values(hooksData[library] ?? {});

  if (entries.length === 0) return null;

  return (
    <div className="space-y-6">
      <SectionHeader as="h3" className="mb-2">
        {sectionTitle}
      </SectionHeader>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {entries.map((hook) => (
        <HookSourceBlock key={hook.name} hook={hook} />
      ))}
    </div>
  );
}
