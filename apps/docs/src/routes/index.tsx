import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button/button";
import {
	getEnabledDocsLibraries,
	PRIMARY_DOCS_LIBRARY_ID,
} from "@/lib/docs-library";

export const Route = createFileRoute("/")({ component: LandingPage });

const enabledLibraries = getEnabledDocsLibraries();

function LandingPage() {
	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center space-y-6">
				<h1 className="text-4xl font-bold text-foreground">diffgazer docs hub</h1>

				<p className="text-muted-foreground text-sm max-w-md mx-auto">
					Select docs by library. Registry endpoints are hosted under the same
					domain for shadcn compatibility.
				</p>

				<div className="flex items-center justify-center gap-3">
					<Link to="/$lib/docs" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
						<Button variant="primary" bracket>
							Get Started
						</Button>
					</Link>
					{enabledLibraries.map((lib) => (
						<Link
							key={lib.id}
							to="/$lib/docs/$"
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
					<kbd className="border border-border px-1.5 py-0.5 text-xs rounded">
						Cmd+K
					</kbd>{" "}
					to search
				</p>
			</div>
		</div>
	);
}
