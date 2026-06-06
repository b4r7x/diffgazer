export function kebabToCamelCase(str: string): string {
  return str
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
}

export function toDocExportName(name: string): string {
  return `${kebabToCamelCase(name)}Doc`
}

export function toYamlString(value: string): string {
  return JSON.stringify(value)
}
