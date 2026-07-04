import type { HookData } from "@/lib/generated-doc-data";
import type { ComponentData } from "@/types/data";

const SAFE_NAME = /^[a-z0-9-]+$/;

type DocDataByType = {
  components: ComponentData;
  hooks: HookData;
};

type LoadDocDataOptions = {
  throwIfMissing?: boolean;
};

export async function loadDocData<T extends keyof DocDataByType>(
  library: string,
  type: T,
  name: string | undefined,
  options: LoadDocDataOptions = {},
): Promise<DocDataByType[T] | null> {
  if (!name || !SAFE_NAME.test(name)) return null;
  try {
    const mod: { default: DocDataByType[T] } = await import(
      `../generated/${library}/${type}/${name}.json`
    );
    return mod.default;
  } catch {
    if (options.throwIfMissing) {
      throw new Error(`Missing generated docs data: ${library}/${type}/${name}`);
    }
    return null;
  }
}
