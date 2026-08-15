import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { type ReactNode, useEffect, useState } from "react";
import type { HookData, HookDataMap } from "@/lib/generated-doc-data";
import { hookSourceFiles } from "@/lib/library";
import { loadLibraryHooksData } from "@/lib/load-hooks-data";
import { CopyButton } from "./copy-button";
import { SourceViewer } from "./docs-mdx/source-viewer";

type LibraryHooksState =
  | { library: string; status: "loading" }
  | { library: string; status: "ready"; data: HookDataMap }
  | { library: string; status: "error" };

interface LibraryHooksResult {
  state: LibraryHooksState;
  retry: () => void;
}

function useLibraryHooksData(library: string): LibraryHooksResult {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<LibraryHooksState>({
    library,
    status: "loading",
  });

  const retry = () => {
    setRetryCount((count) => count + 1);
    setState({ library, status: "loading" });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount is the explicit reload signal.
  useEffect(() => {
    let active = true;

    setState({ library, status: "loading" });
    void loadLibraryHooksData(library)
      .then((data) => {
        if (active) setState({ library, status: "ready", data });
      })
      .catch(() => {
        if (active) setState({ library, status: "error" });
      });

    return () => {
      active = false;
    };
  }, [library, retryCount]);

  if (state.library !== library) {
    return {
      state: { library, status: "loading" },
      retry,
    };
  }

  return { state, retry };
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
  hint: ReactNode;
}

export function LibraryHookSource({ library, sectionTitle, hint }: LibraryHookSourceProps) {
  const { state, retry } = useLibraryHooksData(library);

  if (state.status === "loading") {
    return (
      <output aria-live="polite" className="text-sm text-muted-foreground">
        Loading hook source...
      </output>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-error-text">
          Hook source could not be loaded.
        </p>
        <button type="button" className="text-xs font-mono underline" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  const entries = Object.values(state.data);
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
