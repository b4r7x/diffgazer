import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { useNavigation } from "@diffgazer/keys";
import { extractImportSpecifiers } from "@diffgazer/registry";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  buildComponentCopyArchive,
  type ComponentCopyArchive,
} from "../../../scripts/build-docs-data";
import { axe } from "../../../testing/axe";
import { type ButtonRenderProps, buttonVariants } from "./button";
import { Button } from "./index";

const branchOptions = [
  { id: "main", label: "main" },
  { id: "develop", label: "develop" },
] as const;

function BranchList({ onChoose }: { onChoose: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { highlighted, isHighlighted, onKeyDown } = useNavigation({
    containerRef,
    role: "option",
    onEnter: onChoose,
    onSelect: onChoose,
  });

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Branches"
      aria-activedescendant={highlighted ? `branch-${highlighted}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {branchOptions.map((option) => (
        // biome-ignore lint/a11y/useFocusableInteractive: the listbox owns focus through aria-activedescendant.
        <div
          key={option.id}
          id={`branch-${option.id}`}
          role="option"
          data-value={option.id}
          aria-selected={isHighlighted(option.id)}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}

function fixturePath(root: string, target: string): string {
  if (target.startsWith("@ui/")) {
    return resolve(root, "src/components/ui", target.slice("@ui/".length));
  }
  if (target.startsWith("@hooks/")) {
    return resolve(root, "src/hooks", target.slice("@hooks/".length));
  }
  if (target.startsWith("@lib/")) {
    return resolve(root, "src/lib", target.slice("@lib/".length));
  }
  if (target.startsWith("~/")) return resolve(root, target.slice(2));
  throw new Error(`Unsupported fixture target: ${target}`);
}

function resolveFixtureImport(root: string, sourcePath: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/components/ui/")) {
    base = resolve(root, "src/components/ui", specifier.slice("@/components/ui/".length));
  } else if (specifier.startsWith("@/hooks/")) {
    base = resolve(root, "src/hooks", specifier.slice("@/hooks/".length));
  } else if (specifier.startsWith("@/lib/")) {
    base = resolve(root, "src/lib", specifier.slice("@/lib/".length));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(sourcePath), specifier);
  } else {
    return null;
  }

  return (
    [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find(
      existsSync,
    ) ?? base
  );
}

function materializeArchive(root: string, archive: ComponentCopyArchive): string[] {
  const sourceByTarget = new Map<string, string>();
  for (const file of archive.files) {
    const target = fixturePath(root, file.target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
    sourceByTarget.set(file.target, target);
  }

  const unresolved: string[] = [];
  for (const [target, sourcePath] of sourceByTarget) {
    const source = archive.files.find((file) => file.target === target)?.content;
    if (!source || !/\.[cm]?[jt]sx?$/.test(sourcePath)) continue;

    for (const { specifier } of extractImportSpecifiers(source)) {
      const resolved = resolveFixtureImport(root, sourcePath, specifier);
      if (resolved && !existsSync(resolved)) unresolved.push(`${target}: ${specifier}`);
    }
  }
  return unresolved;
}

describe("Button", () => {
  it("keeps active-descendant options out of the tab order and announces the highlight", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { container } = render(
      <>
        <Button>Before</Button>
        <BranchList onChoose={onChoose} />
        <Button>After</Button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.tab();

    const listbox = screen.getByRole("listbox", { name: "Branches" });
    expect(listbox).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await user.keyboard("{ArrowDown}");
    const main = screen.getByRole("option", { name: "main" });
    expect(listbox).toHaveAttribute("aria-activedescendant", main.id);
    expect(main).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith("main", expect.any(KeyboardEvent));

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps text sizes reflowable and reserves no-wrap sizing for icon buttons", () => {
    const minimumHeights = { sm: "min-h-7", md: "min-h-9", lg: "min-h-11" } as const;
    for (const size of ["sm", "md", "lg"] as const) {
      const classes = buttonVariants({ size }).split(" ");
      expect(classes).toContain("max-w-full");
      expect(classes).toContain("wrap-anywhere");
      expect(classes).toContain("whitespace-normal");
      expect(classes).toContain(minimumHeights[size]);
      expect(classes).not.toContain("whitespace-nowrap");
    }

    const iconClasses = buttonVariants({ size: "icon" }).split(" ");
    expect(iconClasses).toContain("whitespace-nowrap");
    expect(iconClasses).toContain("h-9");
    expect(iconClasses).toContain("w-9");
  });

  it.each([
    ["button", false],
    ["accordion", true],
  ] as const)("ships a dependency-closed %s copy archive in a clean fixture", (itemName, hasKeys) => {
    const fixture = mkdtempSync(join(tmpdir(), `diffgazer-${itemName}-archive-`));
    try {
      const archive = buildComponentCopyArchive(itemName);
      expect(archive.registryDependencies).toEqual([]);
      expect(new Set(archive.files.map((file) => file.target)).size).toBe(archive.files.length);
      expect(materializeArchive(fixture, archive)).toEqual([]);

      const source = archive.files.map((file) => file.content).join("\n");
      expect(source).not.toContain('from "@diffgazer/keys"');
      expect(archive.files.some((file) => file.target.startsWith("@hooks/"))).toBe(hasKeys);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("renders as a button element by default", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("exposes highlighted state on the native button branch", () => {
    const { rerender } = render(<Button highlighted>Native</Button>);
    expect(screen.getByRole("button", { name: "Native" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    rerender(<Button highlighted={false}>Native</Button>);
    expect(screen.getByRole("button", { name: "Native" })).not.toHaveAttribute("data-highlighted");
  });

  it("exposes highlighted state on the anchor branch", () => {
    const { rerender } = render(
      <Button as="a" href="/test" highlighted>
        Anchor
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Anchor" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    rerender(
      <Button as="a" href="/test" highlighted={false}>
        Anchor
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Anchor" })).not.toHaveAttribute("data-highlighted");
  });

  it("provides highlighted state to the render-prop branch", () => {
    function ComposedButton({ highlighted }: { highlighted: boolean }) {
      return (
        <Button highlighted={highlighted}>
          {(buttonProps: ButtonRenderProps) => (
            <button type="button" data-highlighted={buttonProps["data-highlighted"]}>
              Composed
            </button>
          )}
        </Button>
      );
    }

    const { rerender } = render(<ComposedButton highlighted />);
    expect(screen.getByRole("button", { name: "Composed" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    rerender(<ComposedButton highlighted={false} />);
    expect(screen.getByRole("button", { name: "Composed" })).not.toHaveAttribute(
      "data-highlighted",
    );
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders as an anchor when as='a'", () => {
    render(
      <Button as="a" href="/test">
        Link
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "/test");
  });

  it("shows loading state with aria-busy and a data-loading hook, staying focusable", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveAttribute("data-loading", "true");
    // Loading is a busy state, not a native disable: the button keeps focus and
    // exposes aria-disabled instead of dropping focus to <body>.
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it("does not fire onClick while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a focused button focusable when it enters loading", () => {
    const { rerender } = render(<Button>Save</Button>);
    const btn = screen.getByRole("button");
    btn.focus();
    expect(btn).toHaveFocus();

    rerender(<Button loading>Save</Button>);
    expect(btn).toHaveFocus();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("renders the spinner indicator after the lazy chunk resolves", async () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    // querySelector: Spinner is wrapped in aria-hidden so it is excluded from
    // the accessibility tree; this structural assertion confirms the lazy
    // Suspense fallback resolved and the spinner mounted inside the button.
    await waitFor(() => {
      expect(btn.querySelector('[role="status"][aria-label="Loading"]')).not.toBeNull();
    });
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("prevents disabled anchor navigation without firing consumer clicks", () => {
    const spy = vi.fn();
    render(
      <Button as="a" href="/test" disabled onClick={spy}>
        Link
      </Button>,
    );
    const link = screen.getByRole("link");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    link.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("removes a disabled anchor from the tab order and makes it non-navigable", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button as="a" href="/before">
          Before
        </Button>
        <Button as="a" href="/test" disabled>
          Link
        </Button>
        <Button as="a" href="/after">
          After
        </Button>
      </>,
    );
    const disabled = screen.getByRole("link", { name: "Link" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).toHaveAttribute("tabindex", "-1");
    expect(disabled).not.toHaveAttribute("href");

    screen.getByRole("link", { name: "Before" }).focus();
    await user.tab();

    expect(screen.getByRole("link", { name: "After" })).toHaveFocus();
    expect(disabled).not.toHaveFocus();
  });

  it("keeps a consumer tabIndex on an enabled anchor but forces -1 when disabled", () => {
    const { rerender } = render(
      <Button as="a" href="/test" tabIndex={0}>
        Link
      </Button>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "0");

    rerender(
      <Button as="a" href="/test" tabIndex={0} disabled>
        Link
      </Button>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "-1");
  });

  it("renders bracket decoration when bracket is true", () => {
    render(<Button bracket>Action</Button>);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("[");
    expect(btn.textContent).toContain("]");
  });

  it("supports render prop children", () => {
    render(<Button variant="primary">{(_props: ButtonRenderProps) => <div>Custom</div>}</Button>);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it.each([
    "disabled",
    "loading",
  ] as const)("prevents %s render-prop anchor activation", (state) => {
    render(
      <Button<HTMLAnchorElement> disabled={state === "disabled"} loading={state === "loading"}>
        {({ ref, disabled: _disabled, onClick, ...buttonProps }) => (
          <a ref={ref} href="/blocked" onClick={onClick} {...buttonProps}>
            Blocked link
          </a>
        )}
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Blocked link" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).not.toHaveAttribute("disabled");
  });

  it("prevents activation on a disabled custom render-prop host", () => {
    render(
      <Button<HTMLDivElement> disabled>
        {({ ref, disabled: _disabled, onClick, tabIndex, ...buttonProps }) => (
          // biome-ignore lint/a11y/useSemanticElements: This test exercises a custom render-prop host.
          <div
            ref={ref}
            role="button"
            tabIndex={tabIndex}
            onClick={onClick}
            onKeyDown={(event) => event.preventDefault()}
            {...buttonProps}
          >
            Custom action
          </div>
        )}
      </Button>,
    );
    const customHost = screen.getByRole("button", { name: "Custom action" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    customHost.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(customHost).toHaveAttribute("aria-disabled", "true");
    expect(customHost).not.toHaveAttribute("disabled");
  });

  it("lets a consumer aria-busy and aria-label win in the button branch", () => {
    render(
      <Button loading aria-busy={false} aria-label="Saving your draft">
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Saving your draft" });
    expect(btn).toHaveAttribute("aria-busy", "false");
  });

  it("lets a consumer aria-busy and aria-label win in the anchor branch", () => {
    render(
      <Button as="a" href="/x" loading aria-busy={false} aria-label="Loading link">
        Go
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Loading link" });
    expect(link).toHaveAttribute("aria-busy", "false");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations as anchor", async () => {
    const { container } = render(
      <Button as="a" href="/test">
        Link
      </Button>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
