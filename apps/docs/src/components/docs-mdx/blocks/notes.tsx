import { Typography } from "@diffgazer/ui/components/typography";
import { useHookData } from "../doc-data-context";

export function Notes() {
	const data = useHookData();
	if (!data?.docs?.notes?.length) return null;

	return (
		<div className="space-y-4">
			{data.docs.notes.map((note) => (
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
