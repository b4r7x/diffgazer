import { Kbd } from "@/components/ui/kbd/kbd";
import { useSearchOpen } from "@/features/search/search-context";

export function SearchHero() {
	const { setOpen } = useSearchOpen();

	return (
		<button
			type="button"
			onClick={() => setOpen(true)}
			aria-label="Search documentation"
			className="group flex w-full max-w-2xl items-center gap-3 border border-border/60 bg-[var(--surface-1)] px-4 py-3 font-mono text-sm text-muted-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
			<span className="flex-1 text-left">
				Search docs, components, hooks…
			</span>
			<Kbd size="sm" className="text-muted-foreground">
				⌘K
			</Kbd>
		</button>
	);
}
