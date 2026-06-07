import { createRouter } from "@tanstack/react-router";
import { GlobalNotFound } from "@/components/global-not-found";
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
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
