import {
	Children,
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { Typography } from "@/components/ui/typography/typography";

interface StepProps {
	title: string;
	children?: ReactNode;
	index?: number;
}

function slugify(title: string): string {
	return title
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

export function Steps({ children }: { children: ReactNode }) {
	const steps = Children.toArray(children).filter(
		(child): child is ReactElement<StepProps> =>
			isValidElement(child) && child.type === Step,
	);

	return (
		<div className="mt-10 mb-4">
			{steps.map((step, index) =>
				cloneElement(step, { index, key: step.props.title }),
			)}
		</div>
	);
}

export function Step({ title, children, index = 0 }: StepProps) {
	const number = `${String(index + 1).padStart(2, "0")}.`;

	return (
		<section className="flex gap-5 py-8 first:pt-0 border-t border-border first:border-t-0">
			<span className="shrink-0 w-7 pt-1 font-mono text-sm text-muted-foreground tabular-nums select-none">
				{number}
			</span>
			<div className="min-w-0 flex-1">
				<Typography
					as="h2"
					size="xl"
					id={slugify(title)}
					className="font-bold text-foreground mb-3 scroll-mt-16"
				>
					{title}
				</Typography>
				{children}
			</div>
		</section>
	);
}
