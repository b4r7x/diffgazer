import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button/button";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center space-y-6">
				<p className="text-muted-foreground text-sm font-mono">
					$ npx diffui init
				</p>

				<h1 className="text-4xl font-bold text-foreground">diffui</h1>

				<p className="text-muted-foreground text-sm max-w-md mx-auto">
					Terminal-inspired UI components for React. Built with Tailwind
					4. No runtime dependencies. Copy and paste into your project.
				</p>

				<div className="flex items-center justify-center gap-3">
					<Link to="/docs">
						<Button variant="primary" bracket>
							Get Started
						</Button>
					</Link>
					<Link
						to="/docs/$"
						params={{ _splat: "components/button" }}
					>
						<Button variant="outline">Components</Button>
					</Link>
				</div>

				<p className="text-muted-foreground text-xs">
					37 components | React 19 | Tailwind 4 | Dark + Light
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
