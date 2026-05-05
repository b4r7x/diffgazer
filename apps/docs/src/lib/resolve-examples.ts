import type { ExampleRef } from "@/types/docs-data"

export function resolveExamples(data: {
  docs?: { examples?: ExampleRef[] } | null
  examples: string[]
}): ExampleRef[] {
  if (data.docs?.examples && data.docs.examples.length > 0) {
    return data.docs.examples
  }
  return data.examples.map((name) => ({
    name,
    title: name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }))
}
