import { Typography } from "@diffgazer/ui/components/typography";
import { useComponentData } from "../doc-data-context";
import { PropsTableBlock } from "./props-table";

export function APIReference() {
	const componentData = useComponentData();

	if (!componentData) return null;

	if (Object.keys(componentData.props).length === 0) return null;

	return (
		<>
			<Typography
				as="h2"
				size="xl"
				id="api-reference"
				className="font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border scroll-mt-16"
			>
				API Reference
			</Typography>
			<PropsTableBlock />
		</>
	);
}
