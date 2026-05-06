const SAFE_NAME = /^[a-z0-9-]+$/

export async function loadDocData<T>(
  library: string,
  type: "components" | "hooks",
  name: string | undefined,
  options?: { optional?: boolean },
): Promise<T | null> {
  if (!name || !SAFE_NAME.test(name)) return null
  try {
    const mod = await import(`../generated/${library}/${type}/${name}.json`)
    return mod.default as T
  } catch {
    if (type === "components") return null
    if (options?.optional) return null
    throw new Error(`Failed to load ${type}/${name} for ${library}`)
  }
}
