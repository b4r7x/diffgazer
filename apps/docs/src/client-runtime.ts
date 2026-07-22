import { z } from "zod";

function configureDocsClientRuntime(): void {
  z.config({ jitless: true });
}

configureDocsClientRuntime();
