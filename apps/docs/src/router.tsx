import { createRouter, Link } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { NotFoundState } from "@/components/not-found-state";
import { Button } from "@/components/ui/button/button";

function DefaultNotFound() {
	return (
		<div className="px-4">
			<NotFoundState
				variant="global"
				title="Page not found"
				description="The requested route does not exist."
				primaryAction={
					<Link to="/docs">
						<Button variant="primary">Open docs</Button>
					</Link>
				}
				secondaryAction={
					<Link to="/">
						<Button variant="ghost">Go home</Button>
					</Link>
				}
			/>
		</div>
	);
}

export const getRouter = () =>
	createRouter({
		routeTree,
		defaultNotFoundComponent: DefaultNotFound,
		scrollRestoration: true,
		scrollRestorationBehavior: "smooth",
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
