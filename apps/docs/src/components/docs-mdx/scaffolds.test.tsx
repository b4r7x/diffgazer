import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { type ComponentPageData, DocDataProvider, type HookPageData } from "./doc-data-context";
import { ComponentDocScaffold, HookDocScaffold } from "./scaffolds";

vi.mock("@tanstack/react-router", async () => {
  const { useLocationMock } = await import("@/testing/router-mock");
  return useLocationMock({ pathname: "/ui/hooks/use-example" });
});

const demoBoundary = vi.hoisted(() => ({
  result: { demos: {}, isLoading: false, loadError: null, retry: () => {} },
}));

vi.mock("@/hooks/use-demos", () => ({ useDemos: () => demoBoundary.result }));

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

beforeEach(() => {
  demoBoundary.result = { demos: {}, isLoading: false, loadError: null, retry: () => {} };
});

describe("documentation scaffolds", () => {
  it("renders loading previews instead of temporary code-only examples while demos load", () => {
    demoBoundary.result = { demos: {}, isLoading: true, loadError: null, retry: () => {} };

    render(
      <Providers>
        <DocDataProvider value={{ type: "component", data: populatedComponent }}>
          <ComponentDocScaffold hero="example-default" />
        </DocDataProvider>
      </Providers>,
    );

    expect(screen.getAllByRole("status", { name: "Loading" })).toHaveLength(2);
    expect(screen.getAllByRole("tab", { name: "Preview" })).toHaveLength(2);
  });

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

  it("keeps every documented example when the hero is not part of the examples list", () => {
    // Button-style page: the hero (button-default) is rendered above the list and
    // is absent from docs.examples, so nothing may be dropped from the list.
    const heroOutsideExamples = {
      ...populatedComponent,
      examples: ["example-variants", "example-secondary"],
      exampleSource: {
        "example-default": source,
        "example-variants": source,
        "example-secondary": source,
      },
      docs: {
        ...populatedComponent.docs,
        examples: [
          { name: "example-variants", title: "Variants" },
          { name: "example-secondary", title: "Secondary" },
        ],
      },
    } satisfies ComponentPageData;

    render(
      <Providers>
        <DocDataProvider value={{ type: "component", data: heroOutsideExamples }}>
          <ComponentDocScaffold hero="example-default" />
        </DocDataProvider>
      </Providers>,
    );

    expect(screen.getByText("Variants")).toBeInTheDocument();
    expect(screen.getByText("Secondary")).toBeInTheDocument();
  });

  it("omits the accessibility heading when the keyboard section carries no content", () => {
    const emptyKeyboard = {
      ...populatedComponent,
      docs: {
        ...populatedComponent.docs,
        keyboard: { description: "", examples: [] },
        notes: [],
      },
    } satisfies ComponentPageData;

    render(
      <Providers>
        <DocDataProvider value={{ type: "component", data: emptyKeyboard }}>
          <ComponentDocScaffold hero="example-default" />
        </DocDataProvider>
      </Providers>,
    );

    expect(screen.queryByRole("heading", { name: "Accessibility" })).not.toBeInTheDocument();
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
