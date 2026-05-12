import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { Footer, FooterProvider, useFooterData } from "@/components/layout";
import { createElement } from "react";
import { usePageFooter } from "./use-page-footer";

interface PageFooterSubjectProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

function PageFooterSubject({ shortcuts, rightShortcuts }: PageFooterSubjectProps) {
  usePageFooter({ shortcuts, rightShortcuts });
  const footer = useFooterData();

  return createElement(Footer, {
    shortcuts: footer.shortcuts,
    rightShortcuts: footer.rightShortcuts,
  });
}

function renderPageFooter(props: PageFooterSubjectProps) {
  return render(
    createElement(
      FooterProvider,
      null,
      createElement(PageFooterSubject, props),
    ),
  );
}

function createPageFooterElement(props: PageFooterSubjectProps) {
  return createElement(
    FooterProvider,
    null,
    createElement(PageFooterSubject, props),
  );
}

describe("usePageFooter", () => {
  it("renders page shortcuts through the footer provider", async () => {
    renderPageFooter({
      shortcuts: [{ key: "Enter", label: "Confirm" }],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    });

    await waitFor(() => {
      expect(screen.getByText("Confirm")).toBeInTheDocument();
      expect(screen.getByText("Back")).toBeInTheDocument();
    });
  });

  it("updates rendered footer content when disabled state changes", async () => {
    const { rerender } = renderPageFooter({
      shortcuts: [{ key: "Enter", label: "Confirm", disabled: false }],
    });

    await screen.findByText("Confirm");

    rerender(
      createPageFooterElement({
        shortcuts: [{ key: "Enter", label: "Confirm", disabled: true }],
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
    });
  });
});
