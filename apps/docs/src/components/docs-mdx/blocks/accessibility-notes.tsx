import { Typography } from "@/components/ui/typography/typography";
import { useComponentData } from "../doc-data-context";

export function AccessibilityNotes() {
	const data = useComponentData();
	const notes = data?.docs?.notes;

	if (!notes?.length) return null;

	return (
		<div className="space-y-4">
			<Typography
				as="h3"
				size="xs"
				className="uppercase tracking-wider text-muted-foreground/60 mb-2"
			>
				Notes
			</Typography>
			{notes.map((note) => (
				<div key={note.title} className="border-l-2 border-border pl-4 py-2">
					<Typography
						as="h4"
						size="sm"
						className="font-bold text-foreground mb-1.5"
					>
						{note.title}
					</Typography>
					<Typography as="p" size="sm" className="max-w-3xl">
						{note.content}
					</Typography>
				</div>
			))}
		</div>
	);
}
