import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { TableOfContents } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { TableOfContentsPanel } from "./toc";

export function DocsPageLayout({
	toc,
	children,
	showToc = true,
}: {
	toc: TableOfContents;
	children: ReactNode;
	showToc?: boolean;
}) {
	return (
		<div className="flex flex-1 flex-row gap-8">
			<div className="flex-1 min-w-0 py-8 px-6">{children}</div>
			{showToc && <TableOfContentsPanel toc={toc} />}
		</div>
	);
}

interface DocsPageHeaderProps {
	title: string;
	description?: string | null;
	tags?: string[];
	className?: string;
}

export function DocsPageHeader({
	title,
	description,
	tags,
	className,
}: DocsPageHeaderProps) {
	const hasTags = Boolean(tags && tags.length > 0);
	const hasDescription = Boolean(description && description.length > 0);

	return (
		<div className={cn("pb-4", className)}>
			<Typography
				as="h1"
				className="text-2xl font-bold text-foreground mb-2"
				data-pagefind-meta="title"
			>
				{title}
			</Typography>

			{hasTags && (
				<div className={cn("flex flex-wrap gap-2", hasDescription && "mb-3")}>
					{tags?.map((tag) => (
						<span
							key={tag}
							className="px-2 py-1 border border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
						>
							{tag}
						</span>
					))}
				</div>
			)}

			{hasDescription && (
				<Typography as="p" className="max-w-3xl">
					{description}
				</Typography>
			)}
		</div>
	);
}

export function DocsPageBody({ children }: { children: ReactNode }) {
	return <Typography variant="prose">{children}</Typography>;
}
