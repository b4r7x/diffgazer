export interface EnvLinks {
  docs: string;
  github: string;
}

interface LandingLinkEnvironment {
  VITE_DOCS_ORIGIN?: string;
  VITE_GITHUB_URL?: string;
}

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

export function resolveLinks(env: LandingLinkEnvironment): EnvLinks {
  return {
    docs: resolveHttpUrl(env.VITE_DOCS_ORIGIN, DEFAULT_DOCS),
    github: resolveHttpUrl(env.VITE_GITHUB_URL, DEFAULT_GITHUB),
  };
}
