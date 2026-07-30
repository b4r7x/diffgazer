import "./client-runtime";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { preloadInitialMdx } from "@/lib/preload-initial-mdx";

const PRELOAD_TIMEOUT_MS = 2_000;

async function startClient() {
  try {
    await Promise.race([
      preloadInitialMdx(),
      new Promise<void>((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
    ]);
  } catch {
    // Hydrate anyway so the page-level boundary can surface the real MDX load error.
  }

  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
}

void startClient();
