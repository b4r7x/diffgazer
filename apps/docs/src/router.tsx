import { createRouter } from "@tanstack/react-router";
import { GlobalNotFound } from "@/components/global-not-found";
import { getRequestNonce } from "@/lib/csp-nonce";
import { routeTree } from "./routeTree.gen";

export const getRouter = () =>
  createRouter({
    routeTree,
    defaultNotFoundComponent: GlobalNotFound,
    scrollRestoration: true,
    scrollRestorationBehavior: "instant",
    scrollToTopSelectors: ["#main-content"],
    // A document opened at a #hash must be at the anchor by its first painted frame.
    // Nothing in the docs reaches a hash through the router today — the TOC scrolls
    // itself and MDX links are plain anchors — so this only decides how the first
    // `<Link hash>` will behave.
    defaultHashScrollIntoView: {
      behavior: "instant",
      block: "start",
      inline: "nearest",
    },
    defaultPreload: "intent",
    // The CSP nonce is stamped onto every SSR-injected inline script so the
    // production CSP can drop 'unsafe-inline'; server.ts supplies it per request.
    ssr: { nonce: getRequestNonce() },
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
