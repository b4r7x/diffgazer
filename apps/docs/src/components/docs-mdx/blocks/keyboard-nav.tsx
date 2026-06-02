import { DemoPreview } from "@/components/demo-preview";
import { Typography } from "@/components/ui/typography/typography";
import { resolvePreviewFrame } from "@/lib/example-frames";
import { useDemos } from "@/lib/use-demos";
import { useComponentData } from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

export function KeyboardNav() {
	const data = useComponentData();
	const library = useCurrentLibrary();
	const demos = useDemos(library);

	if (!data?.docs?.keyboard) return null;
	const { description, examples } = data.docs.keyboard;

	return (
		<div>
			<Typography as="h3" size="sm" className="font-bold text-foreground mb-3">
				Keyboard Navigation
			</Typography>
			<Typography as="p" size="sm" className="mb-4">
				{description}
			</Typography>
			{examples.length > 0 && (
				<div className="space-y-6">
					{examples.map((ex) => (
						<DemoPreview
							key={ex.name}
							title={ex.title}
							demo={demos[ex.name] ?? null}
							code={data.exampleSource[ex.name]?.highlighted ?? []}
							rawCode={data.exampleSource[ex.name]?.raw ?? ""}
							frame={resolvePreviewFrame(ex.name)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
