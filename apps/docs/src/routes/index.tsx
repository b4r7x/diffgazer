import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button/button";
import { Kbd } from "@/components/ui/kbd/kbd";
import {
	getEnabledDocsLibraries,
	PRIMARY_DOCS_LIBRARY_ID,
} from "@/lib/docs-library";
import { buildPageSeo } from "@/lib/seo";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => {
		const seo = buildPageSeo({
			title: "diffgazer docs hub",
			pathname: "/",
			type: "website",
		});
		return { meta: seo.meta, links: seo.links };
	},
});

const enabledLibraries = getEnabledDocsLibraries();

function LandingPage() {
	return (
		<main id="main-content" className="flex items-center justify-center min-h-screen">
			<div className="text-center space-y-6">
				<h1 className="text-4xl font-bold text-foreground">diffgazer docs hub</h1>

				<p className="text-muted-foreground text-sm max-w-md mx-auto">
					Select docs by library. Generated registry endpoints are packaged for
					shadcn compatibility and will be hosted with the docs deployment.
				</p>

				<div className="flex items-center justify-center gap-3">
					<Link to="/$lib" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
						<Button variant="primary" bracket>
							Get Started
						</Button>
					</Link>
					{enabledLibraries.map((lib) => (
						<Link
							key={lib.id}
							to="/$lib/$"
							params={{
								lib: lib.id,
								_splat: lib.defaultRouteSlugs.join("/"),
							}}
						>
							<Button variant="outline">{lib.id}</Button>
						</Link>
					))}
				</div>

				<p className="text-muted-foreground text-xs">
					Press{" "}
					<Kbd>⌘K</Kbd>{" "}
					to search
				</p>
			</div>
		</main>
	);
}
