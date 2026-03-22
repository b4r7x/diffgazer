import { hooksData, libsData } from "@/generated/library-data"

type SourceEntry = { source: { raw: string; highlighted: Array<{ number: number }> } }
type SourceDataMap = Record<string, SourceEntry>

function buildDataMap(): Record<string, Record<string, SourceDataMap>> {
  const map: Record<string, Record<string, SourceDataMap>> = {}
  for (const [lib, data] of Object.entries(hooksData)) {
    map[lib] = { ...map[lib], hook: data as SourceDataMap }
  }
  for (const [lib, data] of Object.entries(libsData)) {
    map[lib] = { ...map[lib], lib: data as SourceDataMap }
  }
  return map
}

const dataMap = buildDataMap()

// Path prefix per type — how the file appears in the source viewer.
const pathPrefixes: Record<string, string> = {
  hook: "hooks/",
  lib: "lib/",
}

export interface CrossDepSourceFile {
  path: string
  raw: string
  highlighted: Array<{ number: number }>
}

export function resolveCrossDepFiles(
  crossDeps: Array<{ library: string; type: string; items: string[] }>,
): CrossDepSourceFile[] {
  const files: CrossDepSourceFile[] = []
  for (const dep of crossDeps) {
    const typeMap = dataMap[dep.library]?.[dep.type]
    if (!typeMap) continue
    const prefix = pathPrefixes[dep.type] ?? `${dep.type}/`
    for (const item of dep.items) {
      const entry = typeMap[item]
      if (entry) {
        files.push({
          path: `${prefix}${item}.ts`,
          raw: entry.source.raw,
          highlighted: entry.source.highlighted as CrossDepSourceFile["highlighted"],
        })
      }
    }
  }
  return files
}
