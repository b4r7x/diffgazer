import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card/card";
import { Divider } from "@/components/ui/divider/divider";
import { Chevron } from "@/components/ui/icons";
import type { DocsLibraryId } from "@/lib/docs-library";

interface QuickStartCardProps {
	title: string;
	description: string;
	footer: ReactNode;
}

function CardBody({ title, description, footer }: QuickStartCardProps) {
	return (
		<>
			<div className="flex items-center justify-between gap-3">
				<h3 className="font-mono text-2xl font-bold tracking-tight text-foreground">
					{title}
				</h3>
				<Chevron
					direction="right"
					size="md"
					className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
				/>
			</div>
			<Divider />
			<p className="font-mono text-sm leading-relaxed text-muted-foreground">
				{description}
			</p>
			<div className="mt-auto pt-1">{footer}</div>
		</>
	);
}

const CARD_CLASS = "group flex h-full flex-col gap-4 p-5";
const LINK_CLASS =
	"focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

type QuickStartLinkCardProps =
	| (QuickStartCardProps & { to: "/$lib"; params: { lib: DocsLibraryId } })
	| (QuickStartCardProps & {
			to: "/$lib/$";
			params: { lib: DocsLibraryId; _splat: string };
	  });

// Full-card navigable variant: the whole card is a Link, so the footer must be
// non-interactive content (a label, not its own anchor/button). Each route is
// rendered as a distinct Link so TanStack's discriminated `to`/`params` types
// resolve without runtime prop spreading.
export function QuickStartLinkCard(props: QuickStartLinkCardProps) {
	const card = (
		<Card surface="flat" interactive className={CARD_CLASS}>
			<CardBody {...props} />
		</Card>
	);

	if (props.to === "/$lib") {
		return (
			<Link to="/$lib" params={props.params} className={LINK_CLASS}>
				{card}
			</Link>
		);
	}
	return (
		<Link to="/$lib/$" params={props.params} className={LINK_CLASS}>
			{card}
		</Link>
	);
}
