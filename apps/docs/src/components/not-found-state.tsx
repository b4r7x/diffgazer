import {
	EmptyState,
	EmptyStateActions,
	EmptyStateDescription,
	EmptyStateMessage,
} from "@diffgazer/ui/components/empty-state";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";

type NotFoundVariant = "docs" | "global";

export interface NotFoundStateProps {
	variant?: NotFoundVariant;
	statusLabel?: string;
	title: string;
	description: string;
	primaryAction: ReactNode;
	secondaryAction?: ReactNode;
}

const containerVariants: Record<NotFoundVariant, string> = {
	docs: "min-h-full flex justify-center items-center",
	global: "min-h-screen flex justify-center items-center",
};

const contentVariants: Record<NotFoundVariant, string> = {
	docs: "w-full max-w-3xl border border-border bg-secondary/20 px-6 py-7 text-center",
	global: "w-full max-w-2xl text-center",
};

export function NotFoundState({
	variant = "global",
	statusLabel = "404",
	title,
	description,
	primaryAction,
	secondaryAction,
}: NotFoundStateProps) {
	return (
		<div className={cn("flex flex-col", containerVariants[variant])}>
			<SectionHeader className="mb-4 font-mono text-center">
				{statusLabel}
			</SectionHeader>

			<div className={contentVariants[variant]}>
				<EmptyState variant="centered" className="py-0">
					<EmptyStateMessage>
						<Typography as="h1" className="text-2xl font-bold text-foreground">
							{title}
						</Typography>
					</EmptyStateMessage>
					<EmptyStateDescription>{description}</EmptyStateDescription>
					<EmptyStateActions className="mt-5 gap-3 justify-center">
						{primaryAction}
						{secondaryAction}
					</EmptyStateActions>
				</EmptyState>
			</div>
		</div>
	);
}
