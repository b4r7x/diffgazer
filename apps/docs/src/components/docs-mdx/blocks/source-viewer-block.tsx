import { CopyButton } from "@/components/copy-button";
import { SourceViewer } from "@/components/source-viewer";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	CodeBlock,
	CodeBlockContent,
	CodeBlockLine,
	InlineCode,
} from "@/components/ui/code-block";
import { Typography } from "@/components/ui/typography/typography";
import {
	type CrossDepSourceFile,
	resolveCrossDepFiles,
} from "@/lib/cross-deps-data";
import { type DocsLibraryId, getInstallCommand } from "@/lib/docs-library";
import type { ComponentData, SourceFile } from "@/types/docs-data";
import {
	type HookData,
	useComponentData,
	useHookData,
} from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

/** Map cross-dependency files (keys hooks/utilities) into the SourceViewer file shape. */
function toSourceFiles(
	crossDeps: NonNullable<ComponentData["crossDeps"]>,
): (SourceFile & { path: string })[] {
	return resolveCrossDepFiles(crossDeps).map((file: CrossDepSourceFile) => ({
		path: file.path,
		raw: file.raw,
		highlighted: file.highlighted,
	}));
}

export function SourceViewerBlock() {
	const componentData = useComponentData();
	const hookData = useHookData();
	const library = useCurrentLibrary();

	if (componentData)
		return <ComponentSourceViewer data={componentData} library={library} />;
	if (hookData) return <HookSourceViewer data={hookData} />;
	return null;
}

function ComponentSourceViewer({
	data,
	library,
}: {
	data: ComponentData;
	library: DocsLibraryId;
}) {
	const installCommand = getInstallCommand(library, data.name) ?? undefined;
	const sourceFiles = Object.entries(data.source).map(([path, file]) => ({
		path,
		raw: file.raw,
		highlighted: file.highlighted,
	}));

	if (data.crossDeps?.length) {
		sourceFiles.push(...toSourceFiles(data.crossDeps));
	}

	const externalDeps = data.crossDeps?.filter((d) => d.library !== library);
	const integrationNote = externalDeps?.length ? (
		<>
			Keyboard hooks are included as standalone copies. For the full experience,
			use <InlineCode>--integration {externalDeps[0].library}</InlineCode>.
		</>
	) : undefined;

	return (
		<SourceViewer
			files={sourceFiles}
			mergedSource={data.mergedSource}
			installCommand={installCommand}
			integrationNote={integrationNote}
		/>
	);
}

function HookSourceViewer({ data }: { data: HookData }) {
	return (
		<div className="mb-8">
			<div
				className="flex items-baseline justify-between mt-10 mb-4 pb-2 border-b border-border scroll-mt-16"
				id="source"
			>
				<Typography as="h2" size="xl" className="font-bold text-foreground">
					Source
				</Typography>
				<CopyButton text={data.source.raw} label={`Copy ${data.title}`} />
			</div>
			<Accordion collapsible className="divide-y-0">
				<AccordionItem value="source" className="py-0">
					<AccordionTrigger variant="source">View hook source</AccordionTrigger>
					<AccordionContent>
						<CodeBlock>
							<CodeBlockContent>
								{data.source.highlighted.map((line) => (
									<CodeBlockLine key={line.number} {...line} />
								))}
							</CodeBlockContent>
						</CodeBlock>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
