import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ConfigurationErrorNotice, ConfigurationStatus } from "./configuration-status";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

// Boundary mock: the router is the external navigation target of the recovery action.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

function unauthorizedError(): Error {
  return Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" });
}

function credentialError(): Error {
  return Object.assign(new Error("keyring read failed"), {
    status: 500,
    code: "KEYRING_READ_FAILED",
  });
}

function renderStatus(ui: ReactElement, initError: Error = new Error("init unavailable")) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const loadConfigurationInit = vi
    .fn<BoundApi["loadConfigurationInit"]>()
    .mockRejectedValue(initError);
  const api: BoundApi = { ...createApi({ baseUrl: "http://localhost" }), loadConfigurationInit };

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <ConfigProvider>
          <KeyboardProvider>
            <FooterProvider>{ui}</FooterProvider>
          </KeyboardProvider>
        </ConfigProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );

  return { loadConfigurationInit, unmount: view.unmount };
}

describe("ConfigurationStatus", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("announces the failure and retries the configuration load", async () => {
    const user = userEvent.setup();
    const { loadConfigurationInit } = renderStatus(<ConfigurationStatus status="error" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(loadConfigurationInit.mock.calls.length).toBeGreaterThan(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("offers Configure Provider and routes it to the providers screen", async () => {
    const user = userEvent.setup();
    renderStatus(<ConfigurationStatus status="error" />);

    await user.click(screen.getByRole("button", { name: "Configure Provider" }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings/providers" });
  });

  it("keeps Escape on Retry — the recovery action is never the escape path", async () => {
    const user = userEvent.setup();
    const { loadConfigurationInit } = renderStatus(<ConfigurationStatus status="error" />);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(loadConfigurationInit.mock.calls.length).toBeGreaterThan(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("drops the circular Configure action on the providers screen", () => {
    renderStatus(<ConfigurationStatus status="error" showConfigureAction={false} />);

    expect(screen.queryByRole("button", { name: "Configure Provider" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the loading readout before the configuration resolves", () => {
    renderStatus(<ConfigurationStatus status="loading" />);

    expect(screen.getByText("Loading configuration...")).toBeInTheDocument();
  });

  it("names the session-token mismatch instead of the configuration gate on 401", async () => {
    renderStatus(<ConfigurationStatus status="error" />, unauthorizedError());

    expect(await screen.findByText("Session Not Authorized")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Session Not Authorized");
    expect(screen.getByText(/relaunch the app with the diffgazer CLI/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // Provider setup cannot fix a token mismatch, so the gate offers Retry alone.
    expect(screen.queryByRole("button", { name: "Configure Provider" })).not.toBeInTheDocument();
  });

  it("keeps the generic configuration copy for non-401 load failures", async () => {
    renderStatus(<ConfigurationStatus status="error" />, new Error("credential file corrupt"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.queryByText("Session Not Authorized")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure Provider" })).toBeInTheDocument();
  });

  it("turns a credential-caused load failure into the calm reconnect gate", async () => {
    renderStatus(<ConfigurationStatus status="error" />, credentialError());

    expect(await screen.findByRole("heading", { name: "Reconnect Provider" })).toBeInTheDocument();
    // A setup condition, not an app fault: no alarm announcement.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuration Unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure Provider" })).toBeInTheDocument();
  });
});

describe("ConfigurationErrorNotice", () => {
  it("differentiates a 401 from other load failures in the inline copy", () => {
    const { unmount } = renderStatus(<ConfigurationErrorNotice error={unauthorizedError()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Session Not Authorized");
    unmount();

    renderStatus(<ConfigurationErrorNotice error={new Error("init unavailable")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
  });

  it("renders a credential-caused failure as a warning-toned reconnect notice", () => {
    renderStatus(<ConfigurationErrorNotice error={credentialError()} />);

    // Warning tone announces politely as a status, never as an alert.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reconnect Provider");
    expect(screen.getByRole("status")).toHaveTextContent(/re-enter the api key below/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries the configuration load from the inline notice", async () => {
    const user = userEvent.setup();
    const { loadConfigurationInit } = renderStatus(
      <ConfigurationErrorNotice error={new Error("init unavailable")} />,
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(loadConfigurationInit.mock.calls.length).toBeGreaterThan(1));
  });
});
