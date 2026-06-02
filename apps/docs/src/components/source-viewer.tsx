import type React from "react";
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
import { LOCAL_DGADD_PREREQUISITE } from "@/lib/docs-library";
import type { SourceFile } from "@/types/docs-data";
import { CopyButton } from "./copy-button";

interface SourceViewerProps {
	files: (SourceFile & { path: string })[];
	mergedSource?: string;
	installCommand?: string;
	integrationNote?: React.ReactNode;
}

export function SourceViewer({
	files,
	mergedSource,
	installCommand,
	integrationNote,
}: SourceViewerProps) {
	if (files.length === 0) return null;

	return (
		<div className="mb-8">
			<div
				className="flex items-baseline justify-between mt-10 mb-4 pb-2 border-b border-border scroll-mt-16"
				id="source"
			>
				<Typography as="h2" size="2xl" className="font-bold text-foreground">
					Source
				</Typography>
				{mergedSource && (
					<CopyButton
						text={mergedSource}
						label="Copy Full Source"
						title="Copies all component files, hooks, and utilities merged into a single standalone file"
					/>
				)}
			</div>
			{(installCommand || integrationNote) && (
				<Typography as="p" size="sm" className="mb-3 mt-1">
					{installCommand && (
						<>
							Install via CLI: <InlineCode>{installCommand}</InlineCode>.{" "}
							{LOCAL_DGADD_PREREQUISITE}
						</>
					)}
					{installCommand && integrationNote && " "}
					{integrationNote}
				</Typography>
			)}

			<Accordion collapsible className="divide-y-0">
				<AccordionItem value="source" className="py-0">
					<AccordionTrigger variant="source">
						View component source
						{files.length > 1 ? ` (${files.length} files)` : ""}
					</AccordionTrigger>
					<AccordionContent className="space-y-4">
						{files.map((file) => (
							<div key={file.path}>
								<div className="flex items-center justify-between mb-1">
									<span className="text-xs font-mono text-muted-foreground">
										{file.path}
									</span>
									<CopyButton text={file.raw} />
								</div>
								<CodeBlock>
									<CodeBlockContent>
										{file.highlighted.map((line) => (
											<CodeBlockLine key={line.number} {...line} />
										))}
									</CodeBlockContent>
								</CodeBlock>
							</div>
						))}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
