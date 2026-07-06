export interface EnvLinks {
  docs: string;
  github: string;
}

type LandingEnv = Partial<Pick<ImportMetaEnv, "VITE_DOCS_ORIGIN" | "VITE_GITHUB_URL">>;

const DEFAULT_DOCS = "https://docs.b4r7.dev";
const DEFAULT_GITHUB = "https://github.com/b4r7x/diffgazer";

function resolveHttpUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href.replace(/\/$/, "")
      : fallback;
  } catch {
    return fallback;
  }
}

export function resolveLinks(env: LandingEnv = import.meta.env): EnvLinks {
  return {
    docs: resolveHttpUrl(env.VITE_DOCS_ORIGIN, DEFAULT_DOCS),
    github: resolveHttpUrl(env.VITE_GITHUB_URL, DEFAULT_GITHUB),
  };
}

export function wireEnvLinks(root: ParentNode = document, links: EnvLinks = resolveLinks()): void {
  const targets: Record<string, string> = {
    docs: links.docs,
    github: links.github,
    license: `${links.github}/blob/main/LICENSE`,
  };
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[data-link]")) {
    const href = targets[anchor.dataset.link ?? ""];
    if (href) anchor.href = href;
  }
}
