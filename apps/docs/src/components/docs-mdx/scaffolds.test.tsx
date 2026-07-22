// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { type ComponentPageData, DocDataProvider, type HookPageData } from "./doc-data-context";
import { ComponentDocScaffold, HookDocScaffold } from "./scaffolds";

vi.mock("@tanstack/react-router", async () => {
  const { useLocationMock } = await import("@/testing/router-mock");
  return useLocationMock({ pathname: "/ui/hooks/use-example" });
});

vi.mock("@/hooks/use-demos", () => ({ useDemos: () => ({}) }));

const highlighted = [{ number: 1, content: [{ text: "const example = true;" }] }];
const source = { raw: "const example = true;", highlighted };
const componentUsageHighlighted = [{ number: 1, content: [{ text: "<Example />" }] }];
const hookUsageHighlighted = [{ number: 1, content: [{ text: "useExample()" }] }];

const populatedComponent = {
  name: "example",
  title: "Example",
  description: "Example component.",
  dependencies: [],
  files: ["registry/ui/example/example.tsx"],
  props: {
    Example: {
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the example.",
      },
    },
  },
  usageSnippet: "<Example />",
  usageSnippetHighlighted: componentUsageHighlighted,
  examples: ["example-default", "example-secondary"],
  exampleSource: {
    "example-default": source,
    "example-secondary": source,
  },
  docs: {
    usage: { code: "<Example />", lang: "tsx" },
    examples: [
      { name: "example-default", title: "Default" },
      { name: "example-secondary", title: "Secondary" },
    ],
    keyboard: {
      description: "Use Enter to activate.",
      keys: [{ keys: "Enter", action: "Activates the example." }],
      examples: [],
    },
    notes: [{ title: "Labeling", content: "Provide an accessible label." }],
  },
} satisfies ComponentPageData;

const populatedHook = {
  name: "use-example",
  title: "useExample",
  description: "Example hook.",
  docs: {
    usage: { code: "useExample()", lang: "typescript" },
    parameters: [
      {
        name: "enabled",
        type: "boolean",
        required: false,
        description: "Enables the hook.",
      },
    ],
    returns: { type: "boolean", description: "Whether the hook is active." },
    notes: [{ title: "Lifecycle", content: "Cleans up on unmount." }],
    examples: [{ name: "use-example-basic", title: "Basic" }],
  },
  usageSnippet: "useExample()",
  usageSnippetHighlighted: hookUsageHighlighted,
  examples: ["use-example-basic"],
  exampleSource: { "use-example-basic": source },
  files: ["src/hooks/use-example.ts"],
} satisfies HookPageData;

function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("documentation scaffolds", () => {
  it("renders every populated component and hook section from DocDataProvider data", () => {
    const component = render(
      <Providers>
        <DocDataProvider value={{ type: "component", data: populatedComponent }}>
          <ComponentDocScaffold hero="example-default" />
        </DocDataProvider>
      </Providers>,
    );

    for (const heading of [
      "Installation",
      "Usage",
      "Examples",
      "API Reference",
      "Accessibility",
      "Source",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    expect(screen.getByText("ui/example")).toBeInTheDocument();
    expect(screen.getByText("<Example />")).toBeInTheDocument();
    expect(screen.getByText("Secondary")).toBeInTheDocument();
    expect(screen.getByText("Disables the example.")).toBeInTheDocument();
    expect(screen.getByText("Use Enter to activate.")).toBeInTheDocument();
    expect(screen.getByText("Provide an accessible label.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View component source" })).toBeInTheDocument();

    component.unmount();
    render(
      <Providers>
        <DocDataProvider value={{ type: "hook", data: populatedHook }}>
          <HookDocScaffold />
        </DocDataProvider>
      </Providers>,
    );

    for (const heading of [
      "Installation",
      "Parameters",
      "Returns",
      "Examples",
      "Notes",
      "Source",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    expect(screen.getByText("ui/use-example")).toBeInTheDocument();
    expect(screen.getByText("useExample()")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Enables the hook.")).toBeInTheDocument();
    expect(screen.getByText("Whether the hook is active.")).toBeInTheDocument();
    expect(screen.getByText("Cleans up on unmount.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View hook source" })).toBeInTheDocument();
  });

  it("omits every data-dependent section when its structured data is absent", () => {
    const componentWithoutSections = {
      ...populatedComponent,
      files: [],
      props: {},
      usageSnippet: "",
      usageSnippetHighlighted: [],
      examples: ["example-default"],
      exampleSource: { "example-default": source },
      docs: null,
    } satisfies ComponentPageData;
    const component = render(
      <Providers>
        <DocDataProvider value={{ type: "component", data: componentWithoutSections }}>
          <ComponentDocScaffold hero="example-default" />
        </DocDataProvider>
      </Providers>,
    );

    expect(screen.getByRole("heading", { name: "Installation" })).toBeInTheDocument();
    for (const heading of ["Usage", "Examples", "API Reference", "Accessibility", "Source"]) {
      expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
    }

    component.unmount();
    const hookWithoutSections = {
      ...populatedHook,
      docs: null,
      usageSnippet: undefined,
      usageSnippetHighlighted: undefined,
      examples: [],
      exampleSource: {},
      files: [],
    } satisfies HookPageData;
    render(
      <Providers>
        <DocDataProvider value={{ type: "hook", data: hookWithoutSections }}>
          <HookDocScaffold />
        </DocDataProvider>
      </Providers>,
    );

    expect(screen.getByRole("heading", { name: "Installation" })).toBeInTheDocument();
    for (const heading of ["Usage", "Examples", "Parameters", "Returns", "Notes", "Source"]) {
      expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
    }
  });
});
