"use client";

import { type PagerProps, Pager as PagerRoot } from "./pager";
import { PagerLink, type PagerLinkProps, type PagerLinkRenderProps } from "./pager-link";

const Pager = Object.assign(PagerRoot, {
  Link: PagerLink,
});

export { Pager, type PagerProps };
export { PagerLink, type PagerLinkProps, type PagerLinkRenderProps };
