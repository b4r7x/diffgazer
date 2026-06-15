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
    defaultHashScrollIntoView: {
      behavior: "smooth",
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
