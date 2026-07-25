import type { ExampleRef } from "@/types/data";

/** Title for an example that carries no authored one, derived from its id. */
export function exampleTitle(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveExamples(data: {
  docs?: { examples?: ExampleRef[] } | null;
  examples: string[];
}): ExampleRef[] {
  if (data.docs?.examples && data.docs.examples.length > 0) {
    return data.docs.examples;
  }
  return data.examples.map((name) => ({ name, title: exampleTitle(name) }));
}
