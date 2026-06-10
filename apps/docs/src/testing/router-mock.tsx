import type { AnchorHTMLAttributes, ReactNode } from "react";

type RouterLinkMockProps = {
  to: string;
  params?: Record<string, string>;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

function resolveHref(to: string, params: Record<string, string> = {}) {
  let href = to;
  for (const [key, value] of Object.entries(params)) {
    if (key !== "_splat") {
      href = href.replace(`$${key}`, value);
    }
  }
  return params._splat ? href.replace("$", params._splat) : href.replace(/\/\$$/, "");
}

export function RouterLinkMock({ to, params, children, ...rest }: RouterLinkMockProps) {
  return (
    <a href={resolveHref(to, params)} {...rest}>
      {children}
    </a>
  );
}
