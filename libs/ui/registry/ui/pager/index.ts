import { Pager as PagerRoot, type PagerProps } from "./pager";
import { PagerLink, type PagerLinkProps, type PagerLinkRenderProps } from "./pager-link";

const Pager = Object.assign(PagerRoot, {
  Link: PagerLink,
});

export { Pager, type PagerProps };
export { PagerLink, type PagerLinkProps, type PagerLinkRenderProps };
