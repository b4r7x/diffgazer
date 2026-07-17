import { z } from "zod";

export function configureDocsClientRuntime(): void {
  z.config({ jitless: true });
}

configureDocsClientRuntime();
