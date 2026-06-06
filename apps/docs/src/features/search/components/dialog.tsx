import { useKey, useScope } from "@diffgazer/keys";
import {
	CommandPalette,
	CommandPaletteContent,
	CommandPaletteFooter,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteList,
} from "@diffgazer/ui/components/command-palette";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { useNavigate } from "@tanstack/react-router";
import { getEnabledDocsLibraries } from "@/lib/library";
import { useSearchOpen } from "@/lib/search-context";
import { type SearchStatus, useSearch } from "../hooks/use-search";

const LIBRARY_LABELS: Record<string, string> = Object.fromEntries(
	getEnabledDocsLibraries().map((lib) => [lib.id, lib.displayName]),
);

const SECTION_LABELS: Record<string, string> = {
	components: "Components",
	"getting-started": "Getting Started",
	theme: "Theme",
	patterns: "Patterns",
	cli: "CLI",
	integrations: "Integrations",
	keys: "Keys",
	api: "API",
	guides: "Guides",
	hooks: "Hooks",
	features: "Features",
	configuration: "Configuration",
	general: "Docs",
};

interface SearchStatusView {
	message: string;
	role: "status" | "alert";
}

function getSearchStatusView(
	hasQuery: boolean,
	status: SearchStatus,
	error: string | null,
): SearchStatusView | null {
	if (!hasQuery) {
		return { message: "Type to search docs...", role: "status" };
	}
	if (status === "error") {
		return { message: error ?? "Search failed. Try again.", role: "alert" };
	}
	if (status === "empty") {
		return { message: "No results found.", role: "status" };
	}
	return null;
}

export function SearchDialog() {
	const { open, setOpen } = useSearchOpen();
	const { query, results, status, error, search } = useSearch();
	const navigate = useNavigate();
	const hasQuery = query.trim().length > 0;
	const statusView = getSearchStatusView(hasQuery, status, error);

	useKey(
		{
			"mod+k": () => setOpen(true),
			"/": () => setOpen(true),
		},
		{ preventDefault: true },
	);

	useScope("search", { enabled: open });

	return (
		<CommandPalette
			open={open}
			onOpenChange={(next) => {
				if (!next) search("");
				setOpen(next);
			}}
			search={query}
			onSearchChange={search}
			onActivate={(id) => navigate({ to: id })}
			shouldFilter={false}
		>
			<CommandPaletteContent size="md">
				<CommandPaletteInput placeholder="Search docs..." />
				<CommandPaletteList className={hasQuery ? "min-h-[240px]" : undefined}>
					{status === "loading" ? (
						<div className="flex items-center justify-center min-h-[240px] text-muted-foreground text-xs font-mono">
							<Spinner variant="braille" size="sm">
								Searching docs...
							</Spinner>
						</div>
					) : statusView ? (
						<div
							role={statusView.role}
							aria-live={statusView.role === "status" ? "polite" : undefined}
							className="flex items-center justify-center min-h-[240px] text-muted-foreground text-xs font-mono"
						>
							{statusView.message}
						</div>
					) : null}
					{hasQuery &&
						status === "success" &&
						results.map((result) => (
							<CommandPaletteItem key={result.id} id={result.url}>
								<div className="flex flex-col gap-0.5">
									<div className="flex items-center gap-2">
										<span>{result.title}</span>
										<span className="text-[10px] text-muted-foreground">
											{SECTION_LABELS[result.section] ?? result.section}
										</span>
										<span className="text-[10px] text-muted-foreground/50">
											{LIBRARY_LABELS[result.library] ?? result.library}
										</span>
									</div>
									{result.excerpt && (
										<span className="text-xs text-muted-foreground truncate">
											{result.excerpt}
										</span>
									)}
								</div>
							</CommandPaletteItem>
						))}
				</CommandPaletteList>
				<CommandPaletteFooter>
					<div className="flex gap-3">
						<span className="flex items-center gap-1">
							<Kbd size="sm">↑↓</Kbd> Navigate
						</span>
						<span className="flex items-center gap-1">
							<Kbd size="sm">↵</Kbd> Select
						</span>
					</div>
					<div className="flex gap-2">
						<span className="flex items-center gap-1">
							Triggered by <Kbd size="sm">⌘K</Kbd>
						</span>
					</div>
				</CommandPaletteFooter>
			</CommandPaletteContent>
		</CommandPalette>
	);
}
