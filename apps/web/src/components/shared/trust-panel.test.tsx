import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrustPanel } from "@/components/shared/trust-panel";

function renderTrustPanel(queryClient: QueryClient, api: BoundApi) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <FooterProvider>
            <KeyboardProvider>
              {children}
              <Toaster />
            </KeyboardProvider>
          </FooterProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<TrustPanel directory="/repo" projectId="proj-1" />, { wrapper: Wrapper });
}

describe("TrustPanel query invalidation", () => {
  let queryClient: QueryClient;
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
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("invalidates review and active-session queries after trust is granted", async () => {
    const user = userEvent.setup();
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      saveTrust,
    } satisfies BoundApi;
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderTrustPanel(queryClient, api);

    await user.click(screen.getByRole("button", { name: /trust & continue/i }));

    await waitFor(() => {
      expect(saveTrust).toHaveBeenCalled();
    });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["review"] }));
  });
});
