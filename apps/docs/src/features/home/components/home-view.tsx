import { Link } from "@tanstack/react-router";
import { Chevron } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo/logo";
import { HEADING_ASCII } from "@/generated/logo-ascii";
import type { DocsLibraryId } from "@/lib/docs-library";
import {
	type HomeLibrary,
	type HomeSectionLink,
	toBrowseRows,
} from "../home-data";
import { BrowseTable } from "./browse-table";
import { QuickStartLinkCard } from "./quick-start-card";
import { SearchHero } from "./search-hero";

const GITHUB_URL = "https://github.com/b4r7x/diffgazer";
const NPM_URL = "https://www.npmjs.com/package/@diffgazer/ui";

function findLibrary(libraries: HomeLibrary[], id: DocsLibraryId) {
	return libraries.find((library) => library.id === id);
}

function findSection(
	library: HomeLibrary | undefined,
	name: string,
): HomeSectionLink | undefined {
	return library?.sections.find((section) => section.name === name);
}

function CardFooterLabel({ children }: { children: string }) {
	return (
		<span className="inline-flex items-center gap-1 font-mono text-xs text-foreground">
			{children}
			<Chevron direction="right" size="sm" />
		</span>
	);
}

function AppCard() {
	return (
		<QuickStartLinkCard
			to="/$lib"
			params={{ lib: "app" }}
			title="diffgazer"
			description="AI code review in your terminal. Local-first, keyboard-driven, provider-agnostic."
			footer={<CardFooterLabel>Open diffgazer docs</CardFooterLabel>}
		/>
	);
}

function UiCard({ components }: { components?: HomeSectionLink }) {
	const count = components?.count ?? 0;
	return (
		<QuickStartLinkCard
			to="/$lib"
			params={{ lib: "ui" }}
			title="@diffgazer/ui"
			description="Primitive and compound terminal-UI building blocks for keyboard-first apps."
			footer={<CardFooterLabel>{`Browse ${count} components`}</CardFooterLabel>}
		/>
	);
}

function KeysCard({ hooks }: { hooks?: HomeSectionLink }) {
	const count = hooks?.count ?? 0;
	return (
		<QuickStartLinkCard
			to="/$lib"
			params={{ lib: "keys" }}
			title="@diffgazer/keys"
			description="Headless keyboard, focus, and scope primitives the UI layer is built on."
			footer={<CardFooterLabel>{`Browse ${count} hooks`}</CardFooterLabel>}
		/>
	);
}

export function HomeView({ libraries }: { libraries: HomeLibrary[] }) {
	const ui = findLibrary(libraries, "ui");
	const keys = findLibrary(libraries, "keys");
	const components = findSection(ui, "Components");
	const keysHooks = findSection(keys, "Hooks");
	const browseRows = toBrowseRows(libraries);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<main
				id="main-content"
				className="flex w-full flex-1 flex-col items-center px-6 py-16"
			>
				<div className="flex w-full max-w-4xl flex-col gap-14 pb-16">
					<div className="flex justify-center pt-2">
						<SearchHero />
					</div>

					<section aria-labelledby="docs-heading" className="flex flex-col gap-6">
						<div className="flex w-fit flex-col border-b border-border pb-4">
							<h1 id="docs-heading" className="sr-only">
								Documentation
							</h1>
							<Logo
								aria-hidden="true"
								text="Documentation"
								asciiText={HEADING_ASCII.documentation}
								className="text-[8px] leading-[1.15] text-foreground sm:text-[14px] md:text-[18px] lg:text-[20px]"
							/>
						</div>
						<p className="max-w-2xl border-l-2 border-foreground pl-4 font-mono text-sm leading-relaxed text-muted-foreground">
							Reference for diffgazer's keyboard-first terminal UI primitives and
							the headless keys layer they are built on. Copy components in with
							the CLI or read each library's components, hooks, and guides.
						</p>
					</section>

					<section
						aria-labelledby="areas-heading"
						className="grid grid-cols-1 gap-4 md:grid-cols-3"
					>
						<h2 id="areas-heading" className="sr-only">
							Documentation areas
						</h2>
						<AppCard />
						<UiCard components={components} />
						<KeysCard hooks={keysHooks} />
					</section>

					<section aria-labelledby="browse-heading" className="flex flex-col gap-4">
						<h2
							id="browse-heading"
							className="border-b border-border/60 pb-2 font-mono text-xl font-bold uppercase tracking-wider text-foreground"
						>
							Browse the docs
						</h2>
						<BrowseTable rows={browseRows} />
					</section>
				</div>
			</main>

			<footer className="mt-auto w-full border-t border-border/60">
				<div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4 font-mono text-xs text-muted-foreground">
					<span className="font-bold">diffgazer / docs</span>
					<nav aria-label="External links" className="flex items-center gap-6">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							GitHub
						</a>
						<a
							href={NPM_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							NPM
						</a>
						<Link
							to="/$lib"
							params={{ lib: "ui" }}
							className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							Docs
						</Link>
					</nav>
				</div>
			</footer>
		</div>
	);
}
