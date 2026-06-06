import { Link } from "@tanstack/react-router";
import type { HomeBrowseRow } from "../data";

function rowMeta(row: HomeBrowseRow): string {
	return row.count > 0
		? `${row.count} ${row.count === 1 ? "page" : "pages"}`
		: "";
}

export function BrowseTable({ rows }: { rows: HomeBrowseRow[] }) {
	return (
		<nav aria-label="Browse documentation" className="border border-border/60">
			<ul className="flex flex-col">
				{rows.map((row) => (
					<li
						key={`${row.lib}/${row.splat}`}
						className="border-b border-border/60 last:border-b-0"
					>
						<Link
							to="/$lib/$"
							params={{ lib: row.lib, _splat: row.splat }}
							className="grid grid-cols-12 items-center gap-4 px-4 py-4 transition-colors hover:bg-[var(--surface-1)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
						>
							<span className="col-span-4 truncate font-mono text-sm text-muted-foreground sm:col-span-3">
								{row.libraryName}
							</span>
							<span className="col-span-5 truncate font-mono text-base text-foreground sm:col-span-6">
								{row.name}
							</span>
							<span className="col-span-3 text-right font-mono text-sm text-muted-foreground">
								{rowMeta(row)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
