import { type EnvLinks, resolveLinks } from "./links";

export function wireEnvLinks(
  root: ParentNode = document,
  links: EnvLinks = resolveLinks(import.meta.env),
): void {
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
