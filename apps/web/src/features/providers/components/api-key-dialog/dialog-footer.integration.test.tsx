import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { KeyboardProvider } from "@diffgazer/keys";
import { FooterProvider, useFooterData, usePageFooter } from "@diffgazer/core/footer";
import { Footer } from "@/components/layout";
import { ApiKeyDialog } from "./api-key-dialog";

beforeAll(() => {
  if (typeof HTMLDialogElement === "undefined") return;
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
});

function MountedFooter() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function ProvidersPageStub({ dialogOpen }: { dialogOpen: boolean }) {
  const [open, setOpen] = useState(dialogOpen);

  usePageFooter(
    open
      ? { shortcuts: [], rightShortcuts: [] }
      : {
          shortcuts: [{ key: "↑/↓", label: "Navigate Providers" }],
          rightShortcuts: [{ key: "Esc", label: "Back" }],
        },
  );

  return (
    <>
      <MountedFooter />
      <ApiKeyDialog
        open={open}
        onOpenChange={setOpen}
        providerName="Z.AI"
        envVarName="ZAI_API_KEY"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    </>
  );
}

function renderProvidersStub(dialogOpen: boolean) {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <ProvidersPageStub dialogOpen={dialogOpen} />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

describe("ApiKeyDialog footer integration", () => {
  it("renders dialog kbd hints with the standardized wording and glyphs while open", () => {
    renderProvidersStub(true);

    const dialog = screen.getByRole("dialog", { name: /API Key/ });

    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeInTheDocument();

    const kbdNodes = within(dialog).getAllByText(
      (_, element) => element?.tagName === "KBD",
    );
    const kbdTexts = kbdNodes.map((node) => node.textContent);
    expect(kbdTexts).toEqual(
      expect.arrayContaining(["↑/↓", "Enter/Space", "Esc", "Enter"]),
    );

    expect(within(dialog).getByText("Navigate")).toBeInTheDocument();
    expect(within(dialog).getByText("Select")).toBeInTheDocument();
  });

  it("clears the global footer shortcuts while the dialog is open", () => {
    renderProvidersStub(true);

    expect(screen.queryByText("Navigate Providers")).not.toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("restores the global footer shortcuts when the dialog is closed", () => {
    renderProvidersStub(false);

    expect(screen.getByText("Navigate Providers")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });
});
