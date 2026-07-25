import { exampleTitle } from "../../src/lib/resolve-examples.ts";
import type {
  PreparedComponentScaffold,
  PreparedExample,
  PreparedHookScaffold,
  PreparedInstallation,
  PreparedSourceFile,
} from "../../src/lib/scaffold-data.ts";
import { codeBlock, markdownTable } from "./markdown-primitives.ts";

function sourceLanguage(path: string): string {
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".tsx")) return "tsx";
  return "typescript";
}

export function renderInstallation(installation: PreparedInstallation): string {
  const paths = installation.paths.map((path) => {
    const details = path.details.map((detail) => `- **${detail.label}:** \`${detail.value}\``);
    const parts = [
      `### ${path.label}`,
      path.available ? "Available." : "Not currently available.",
      path.command ? codeBlock(path.command, "bash") : "",
      details.join("\n"),
      path.note ?? "",
    ];
    return parts.filter(Boolean).join("\n\n");
  });
  if (installation.note) paths.push(installation.note);
  return paths.join("\n\n");
}

export function renderExample(example: PreparedExample): string {
  const source = example.raw ? codeBlock(example.raw, "tsx") : `Example id: \`${example.name}\`.`;
  return `### ${example.title}\n\n${source}`;
}

export function renderExamples(examples: PreparedExample[]): string {
  return examples.map(renderExample).join("\n\n");
}

/**
 * Resolves an example by id. The site renders `<Example name>` straight from the page's
 * example sources, so an example the docs example list omits — typically the scaffold hero —
 * still has to render here.
 */
export function resolveExampleByName(
  data: { examples: PreparedExample[]; exampleSource: Record<string, string> },
  name: string,
): PreparedExample | undefined {
  const listed = data.examples.find((example) => example.name === name);
  if (listed) return listed;
  const raw = data.exampleSource[name];
  return raw === undefined ? undefined : { name, title: exampleTitle(name), raw };
}

/** The hero example is rendered on its own, so the list must not repeat it. */
export function withoutHero(
  examples: PreparedExample[],
  hero: string | undefined,
): PreparedExample[] {
  return hero ? examples.filter((example) => example.name !== hero) : examples;
}

export function renderSource(sourceFiles: PreparedSourceFile[]): string {
  return sourceFiles
    .map((file) => {
      if (!file.raw) return `- \`${file.path}\``;
      return `### \`${file.path}\`\n\n${codeBlock(file.raw, sourceLanguage(file.path))}`;
    })
    .join("\n\n");
}

export function renderComponentApi(data: PreparedComponentScaffold): string {
  const sections: string[] = [];
  for (const [component, props] of Object.entries(data.props)) {
    const rows = Object.entries(props).map(([name, prop]) => [
      name,
      prop.type,
      prop.required ? "Yes" : "No",
      prop.defaultValue ?? "—",
      prop.description,
    ]);
    if (rows.length > 0) {
      sections.push(
        `### ${component}\n\n${markdownTable(
          ["Prop", "Type", "Required", "Default", "Description"],
          rows,
        )}`,
      );
    }
  }

  if (data.dataAttributes.length > 0) {
    sections.push(
      `### Data attributes\n\n${markdownTable(
        ["Attribute", "Applies to", "Values", "Description"],
        data.dataAttributes.map((item) => [
          item.attribute,
          item.appliesTo,
          item.values,
          item.description,
        ]),
      )}`,
    );
  }
  if (data.cssVariables.length > 0) {
    sections.push(
      `### CSS variables\n\n${markdownTable(
        ["Name", "Default", "Description"],
        data.cssVariables.map((item) => [
          item.name,
          item.defaultValue ?? "component-defined",
          item.description,
        ]),
      )}`,
    );
  }
  return sections.join("\n\n");
}

export function renderAccessibility(data: PreparedComponentScaffold): string {
  const sections: string[] = [];
  const keyboard = data.keyboard;
  if (keyboard) {
    const keyboardParts = ["### Keyboard Navigation", keyboard.description];
    if (keyboard.keys && keyboard.keys.length > 0) {
      keyboardParts.push(
        markdownTable(
          ["Key", "Action"],
          keyboard.keys.map((row) => [row.keys, row.action]),
        ),
      );
    }
    if (keyboard.examples.length > 0) {
      keyboardParts.push(
        keyboard.examples
          .map((example) => `- **${example.title}** (\`${example.name}\`)`)
          .join("\n"),
      );
    }
    sections.push(keyboardParts.filter(Boolean).join("\n\n"));
  }
  if (data.accessibilityNotes.length > 0) {
    sections.push(
      `### Notes\n\n${data.accessibilityNotes
        .map((note) => `#### ${note.title}\n\n${note.content}`)
        .join("\n\n")}`,
    );
  }
  return sections.join("\n\n");
}

export function renderParameters(data: PreparedHookScaffold): string {
  return markdownTable(
    ["Parameter", "Type", "Required", "Default", "Description"],
    data.parameters.map((parameter) => [
      parameter.name,
      parameter.type,
      parameter.required ? "Yes" : "No",
      parameter.defaultValue ?? "—",
      parameter.description,
    ]),
  );
}

export function renderReturns(data: PreparedHookScaffold): string {
  if (!data.returns) return "";
  const parts = [`**Type:** \`${data.returns.type}\``, data.returns.description];
  if (data.returns.properties && data.returns.properties.length > 0) {
    parts.push(
      markdownTable(
        ["Property", "Type", "Required", "Default", "Description"],
        data.returns.properties.map((property) => [
          property.name,
          property.type,
          property.required ? "Yes" : "No",
          property.defaultValue ?? "—",
          property.description,
        ]),
      ),
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

export function renderNotes(data: PreparedHookScaffold): string {
  return data.notes.map((note) => `### ${note.title}\n\n${note.content}`).join("\n\n");
}

export function renderComponentScaffold(data: PreparedComponentScaffold, hero?: string): string {
  const heroExample = hero ? resolveExampleByName(data, hero) : undefined;
  const examples = withoutHero(data.examples, hero);
  const api = renderComponentApi(data);
  const accessibility = renderAccessibility(data);
  const sections = [
    heroExample ? `## Example\n\n${renderExample(heroExample)}` : "",
    `## Installation\n\n${renderInstallation(data.installation)}`,
    data.usage ? `## Usage\n\n${codeBlock(data.usage.code, data.usage.lang)}` : "",
    examples.length > 0 ? `## Examples\n\n${renderExamples(examples)}` : "",
    api ? `## API Reference\n\n${api}` : "",
    accessibility ? `## Accessibility\n\n${accessibility}` : "",
    data.sourceFiles.length > 0 ? `## Source\n\n${renderSource(data.sourceFiles)}` : "",
  ];
  return sections.filter(Boolean).join("\n\n");
}

export function renderHookScaffold(data: PreparedHookScaffold): string {
  const sections = [
    data.usage ? `## Usage\n\n${codeBlock(data.usage.code, data.usage.lang)}` : "",
    `## Installation\n\n${renderInstallation(data.installation)}`,
    data.parameters.length > 0 ? `## Parameters\n\n${renderParameters(data)}` : "",
    data.returns ? `## Returns\n\n${renderReturns(data)}` : "",
    data.examples.length > 0 ? `## Examples\n\n${renderExamples(data.examples)}` : "",
    data.notes.length > 0 ? `## Notes\n\n${renderNotes(data)}` : "",
    data.sourceFiles.length > 0 ? `## Source\n\n${renderSource(data.sourceFiles)}` : "",
  ];
  return sections.filter(Boolean).join("\n\n");
}
