import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { themeBootstrap } from "@/hooks/theme-bootstrap";
import { THEME_BOOTSTRAP_CONFIG, ThemeProvider } from "@/hooks/theme-context";
import { THEME_DOCS_PLAYGROUND_ORDER } from "../lib/token-presentation";
import { ThemePlayground } from "./playground";

function renderPlayground() {
  return render(
    <ThemeProvider>
      <ThemePlayground />
    </ThemeProvider>,
  );
}

function previewStyleWrapper(): HTMLElement | null {
  const previewPanel = screen
    .getByRole("region", { name: "Preview" })
    .querySelector("[data-theme-preview]");
  return previewPanel?.parentElement ?? null;
}

describe("ThemePlayground preview theme", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("inherits the adopted document theme before primitives are edited", () => {
    localStorage.setItem("@diffgazer/docs-theme", "light");
    themeBootstrap(THEME_BOOTSTRAP_CONFIG);

    renderPlayground();

    expect(previewStyleWrapper()).not.toHaveAttribute("style");
  });

  it("applies inline primitive overrides only after a color is edited", async () => {
    const user = userEvent.setup();
    renderPlayground();

    expect(previewStyleWrapper()).not.toHaveAttribute("style");

    const bgInput = screen.getByLabelText("Hex value for --base-bg");
    await user.clear(bgInput);
    await user.type(bgInput, "#3311aa");

    expect(previewStyleWrapper()).toHaveStyle({ "--base-bg": "#3311aa" });
  });
});

describe("ThemePlayground panel headers", () => {
  it.each([
    "Primitives",
    "Preview",
    "Generated CSS",
  ])("names the %s region by its level-3 heading", (name) => {
    renderPlayground();
    const region = screen.getByRole("region", { name });
    expect(within(region).getByRole("heading", { name, level: 3 })).toBeInTheDocument();
  });

  it("associates the Reset action with the Primitives panel", () => {
    renderPlayground();
    const region = screen.getByRole("region", { name: "Primitives" });
    expect(within(region).getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("demonstrates correct Panel usage in the preview with a titled panel", () => {
    renderPlayground();
    expect(screen.getByRole("heading", { name: "Panel Title", level: 4 })).toBeInTheDocument();
  });
});

describe("ThemePlayground generated CSS", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("emits only the edited declaration and returns to the empty state on Reset", async () => {
    const user = userEvent.setup();
    renderPlayground();

    const generated = screen.getByRole("region", { name: "Generated CSS" });
    expect(within(generated).getByText(/No changes yet/)).toBeInTheDocument();

    const bgInput = screen.getByLabelText("Hex value for --base-bg");
    await user.clear(bgInput);
    await user.type(bgInput, "#3311aa");

    expect(within(generated).getByText('[data-theme="dark"] {')).toBeInTheDocument();
    expect(within(generated).getByText("--base-bg: #3311aa;")).toBeInTheDocument();
    expect(within(generated).queryByText(/--base-fg/)).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole("region", { name: "Primitives" })).getByRole("button", {
        name: "Reset",
      }),
    );

    expect(within(generated).getByText(/No changes yet/)).toBeInTheDocument();
  });

  it("ignores a partial hex until it is a colour the preview can render", async () => {
    const user = userEvent.setup();
    renderPlayground();

    const generated = screen.getByRole("region", { name: "Generated CSS" });
    const bgInput = screen.getByLabelText("Hex value for --base-bg");
    await user.clear(bgInput);
    await user.type(bgInput, "#33");

    expect(bgInput).toHaveValue("#33");
    expect(within(generated).getByText(/No changes yet/)).toBeInTheDocument();
    expect(previewStyleWrapper()).not.toHaveAttribute("style");
    expect(screen.getByLabelText("Color picker for --base-bg")).not.toHaveValue("#33");
  });
});

describe("ThemePlayground primitive controls", () => {
  it("renders a color picker for every editable primitive, in documented order", () => {
    renderPlayground();

    for (const name of THEME_DOCS_PLAYGROUND_ORDER) {
      expect(screen.getByLabelText(`Color picker for ${name}`)).toBeInTheDocument();
    }

    const pickerOrder = screen
      .getAllByLabelText(/^Color picker for --base-/)
      .map((picker) => (picker.getAttribute("aria-label") ?? "").replace("Color picker for ", ""));

    expect(pickerOrder).toEqual([...THEME_DOCS_PLAYGROUND_ORDER]);
  });
});
