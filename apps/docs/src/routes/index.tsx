import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button/button";
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/docs-library";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center space-y-6">
				<p className="text-muted-foreground text-sm font-mono">
					$ npx shadcn@latest add @diffui/button
				</p>

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
					<Link
						to="/$lib/docs/$"
						params={{ lib: "diff-ui", _splat: "components/button" }}
					>
						<Button variant="outline">diff-ui</Button>
					</Link>
					<Link
						to="/$lib/docs/$"
						params={{ lib: "keyscope", _splat: "getting-started/installation" }}
					>
						<Button variant="outline">keyscope</Button>
					</Link>
				</div>

				<p className="text-muted-foreground text-xs">
					Registry namespaces: @diffui + @keyscope
				</p>

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
