import type {
  ConsumptionItemKind,
  ConsumptionLibrary,
  ConsumptionMetadata,
} from "@diffgazer/registry";
import type { ComponentPageData } from "../types/data";
import { getConsumptionMetadata } from "./consumption-metadata";
import type { HookPageData } from "./generated-doc-data";
import { resolveExamples } from "./resolve-examples";

type ComponentDocs = NonNullable<ComponentPageData["docs"]>;
type HookDocs = NonNullable<HookPageData["docs"]>;
type ConsumptionPath = ConsumptionMetadata["paths"]["copy"];

export interface PreparedSourceFile {
  path: string;
  raw?: string;
}

export interface PreparedExample {
  name: string;
  title: string;
  raw?: string;
}

export interface PreparedInstallationPath {
  label: string;
  available: boolean;
  command?: string;
  note?: string;
  details: Array<{ label: string; value: string }>;
}

export interface PreparedInstallation {
  paths: PreparedInstallationPath[];
  note?: string;
}

interface PreparedScaffoldBase {
  installation: PreparedInstallation;
  usage?: { code: string; lang: string };
  examples: PreparedExample[];
  sourceFiles: PreparedSourceFile[];
}

export interface PreparedComponentScaffold extends PreparedScaffoldBase {
  type: "component";
  props: ComponentPageData["props"];
  dataAttributes: NonNullable<ComponentDocs["dataAttributes"]>;
  cssVariables: NonNullable<ComponentDocs["cssVariables"]>;
  keyboard: ComponentDocs["keyboard"] | null;
  accessibilityNotes: NonNullable<ComponentDocs["notes"]>;
}

export interface PreparedHookScaffold extends PreparedScaffoldBase {
  type: "hook";
  parameters: NonNullable<HookDocs["parameters"]>;
  returns: HookDocs["returns"] | undefined;
  notes: NonNullable<HookDocs["notes"]>;
}

export type PreparedScaffoldData = PreparedComponentScaffold | PreparedHookScaffold;

function preparePath(
  label: string,
  path: ConsumptionPath,
  details: Array<{ label: string; value: string | undefined }>,
): PreparedInstallationPath {
  return {
    label,
    available: path.available,
    ...(path.command ? { command: path.command } : {}),
    ...(path.note ? { note: path.note } : {}),
    details: details.flatMap(({ label: detailLabel, value }) =>
      value ? [{ label: detailLabel, value }] : [],
    ),
  };
}

function prepareInstallation(
  library: ConsumptionLibrary,
  itemId: string,
  itemKind: ConsumptionItemKind,
): PreparedInstallation {
  const metadata = getConsumptionMetadata(library, itemId, itemKind);
  const localDestination = metadata.paths.copy.available ? metadata.copyPath : undefined;

  return {
    paths: [
      preparePath("dgadd", metadata.paths.dgadd, [
        { label: "Installs to", value: localDestination },
        { label: "Item", value: metadata.dgaddName },
      ]),
      preparePath("shadcn CLI", metadata.paths.copy, [
        { label: "Copies to", value: localDestination },
      ]),
      preparePath("npm package", metadata.paths.package, [
        { label: "Import", value: metadata.packageImport },
      ]),
    ],
    ...(metadata.cssNote ? { note: metadata.cssNote } : {}),
  };
}

function prepareExamples(
  data: Pick<ComponentPageData, "docs" | "examples" | "exampleSource"> | HookPageData,
): PreparedExample[] {
  return resolveExamples(data).map((example) => {
    const raw = data.exampleSource[example.name]?.raw;
    return { ...example, ...(raw ? { raw } : {}) };
  });
}

function prepareUsage(
  data: Pick<ComponentPageData, "usageSnippet"> | HookPageData,
  lang: string,
): PreparedScaffoldBase["usage"] {
  return data.usageSnippet ? { code: data.usageSnippet, lang } : undefined;
}

function sourceFilesOrPaths(
  files: string[] | undefined,
  sourceFiles: PreparedSourceFile[],
): PreparedSourceFile[] {
  if (sourceFiles.length > 0) return sourceFiles;
  return (files ?? []).map((path) => ({ path }));
}

export function prepareComponentScaffoldData(
  library: ConsumptionLibrary,
  data: ComponentPageData,
  sourceFiles: PreparedSourceFile[] = [],
): PreparedComponentScaffold {
  const usage = prepareUsage(data, "tsx");
  return {
    type: "component",
    installation: prepareInstallation(library, data.name, "component"),
    ...(usage ? { usage } : {}),
    examples: prepareExamples(data),
    sourceFiles: sourceFilesOrPaths(data.files, sourceFiles),
    props: data.props,
    dataAttributes: data.docs?.dataAttributes ?? [],
    cssVariables: data.docs?.cssVariables ?? [],
    keyboard: data.docs?.keyboard ?? null,
    accessibilityNotes: data.docs?.notes ?? [],
  };
}

export function prepareHookScaffoldData(
  library: ConsumptionLibrary,
  data: HookPageData,
  sourceFiles: PreparedSourceFile[] = [],
): PreparedHookScaffold {
  const usage = prepareUsage(data, data.docs?.usage?.lang ?? "tsx");
  return {
    type: "hook",
    installation: prepareInstallation(library, data.name, "hook"),
    ...(usage ? { usage } : {}),
    examples: prepareExamples(data),
    sourceFiles: sourceFilesOrPaths(data.files, sourceFiles),
    parameters: data.docs?.parameters ?? [],
    returns: data.docs?.returns,
    notes: data.docs?.notes ?? [],
  };
}
