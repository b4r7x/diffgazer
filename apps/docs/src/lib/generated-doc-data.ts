import type { CodeBlockLineProps } from "@diffgazer/ui/components/code-block";
import type { z } from "zod";
import type {
  hookDocsSchema,
  sourceFileSchema,
  sourceFileWithPathSchema,
} from "@/lib/doc-data-schemas";

type SourceFile = z.infer<typeof sourceFileSchema>;
type SourceFileWithPath = z.infer<typeof sourceFileWithPathSchema>;
type HookDocs = z.infer<typeof hookDocsSchema>;

export interface HookData {
  name: string;
  title: string;
  description: string;
  source: SourceFile;
  files?: SourceFileWithPath[];
  docs: HookDocs | null;
  usageSnippet?: string;
  usageSnippetHighlighted?: CodeBlockLineProps[];
  examples: string[];
  exampleSource: Record<string, SourceFile>;
}

export type HookPageData = Omit<HookData, "files" | "source"> & {
  files?: string[];
};

export type HookSourceData = Pick<HookData, "files" | "source">;

export type HookDataMap = Record<string, HookData>;
