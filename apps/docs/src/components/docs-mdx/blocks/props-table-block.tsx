import { PropsTable } from "@/components/props-table";
import { useComponentData } from "../doc-data-context";

export function PropsTableBlock() {
	const data = useComponentData();
	if (!data) return null;

	const entries = Object.entries(data.props);
	if (entries.length === 0) return null;

	return (
		<div className="flex flex-col gap-6">
			{entries.map(([componentName, props]) => (
				<PropsTable
					key={componentName}
					componentName={componentName}
					props={props}
				/>
			))}
		</div>
	);
}
