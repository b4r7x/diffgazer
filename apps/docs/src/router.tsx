import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { GlobalNotFound } from "@/components/not-found";


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
