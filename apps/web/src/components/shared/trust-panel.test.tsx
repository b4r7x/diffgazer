import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { TrustPanel } from "@/components/shared/trust-panel";

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function renderTrustPanel(api: BoundApi) {
  const { Wrapper: ApiWrapper, queryClient } = createTestQueryWrapper({ api });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiWrapper>
        <FooterProvider>
          <KeyboardProvider>
            {children}
            <FooterView />
            <Toaster />
          </KeyboardProvider>
        </FooterProvider>
      </ApiWrapper>
    );
  }

  return {
    queryClient,
    ...render(<TrustPanel directory="/repo" />, { wrapper: Wrapper }),
  };
}

describe("TrustPanel query invalidation", () => {
  let saveTrust: BoundApi["saveTrust"];

  beforeEach(() => {
    saveTrust = vi.fn<BoundApi["saveTrust"]>().mockResolvedValue({
      trust: {
        projectId: "proj-1",
        repoRoot: "/repo",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      },
    });
  });

  it("invalidates review and active-session queries after trust is granted", async () => {
    const user = userEvent.setup();
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      saveTrust,
    } satisfies BoundApi;

    const { queryClient } = renderTrustPanel(api);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: /trust & continue/i }));

    await waitFor(() => {
      expect(saveTrust).toHaveBeenCalled();
    });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["review"] }));
  });

  it("registers its own permission footer so trust-gated branches drop stale page hints", async () => {
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveTrust } satisfies BoundApi;

    renderTrustPanel(api);

    // F-087: a trust branch with no footer of its own (e.g. history) keeps the
    // previous page's stale "q Quit"/"s Settings" hints over dead handlers.
    expect(await screen.findByText("Navigate Permissions")).toBeInTheDocument();
    expect(screen.getByText("Toggle Permission")).toBeInTheDocument();
    expect(screen.queryByText("Quit")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
