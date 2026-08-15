import { isApiError } from "@diffgazer/core/api";
import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  CREDENTIAL_ERROR_COPY,
  isCredentialSetupError,
} from "@diffgazer/core/review";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { useNavigate } from "@tanstack/react-router";
import type { Ref } from "react";
import { useConfigActions, useConfigData } from "@/hooks/use-config";
import { CenteredStatus } from "./centered-status";
import { FailureView } from "./failure-view";

/**
 * A 401 is not a broken configuration: the app's session token no longer
 * matches the running server, which happens when the server restarts with a
 * fresh token behind an already-open page. Relaunching re-pairs them, so the
 * copy says that — and offers no Configure Provider action, because provider
 * setup cannot fix a token mismatch.
 */
export const UNAUTHORIZED_ERROR_COPY = {
  title: "Session Not Authorized",
  body: "This session's token no longer matches the running server. Relaunch the app with the diffgazer CLI — or restart the dev server — then retry.",
} as const;

export function isUnauthorizedError(error: Error): boolean {
  return isApiError(error) && (error.code === ErrorCode.UNAUTHORIZED || error.status === 401);
}

interface ConfigurationStatusProps {
  status: "loading" | "error";
  /** The providers screen is the Configure destination itself, so it drops the circular action. */
  showConfigureAction?: boolean;
}

export function ConfigurationStatus({
  status,
  showConfigureAction = true,
}: ConfigurationStatusProps) {
  const { loadState } = useConfigData();
  const { refresh } = useConfigActions();
  const navigate = useNavigate();

  if (status === "error") {
    const retry = { label: "Retry", onAction: () => void refresh() };
    const error = loadState.status === "error" ? loadState.error : null;

    if (error && isUnauthorizedError(error)) {
      return (
        <FailureView
          title={UNAUTHORIZED_ERROR_COPY.title}
          message={UNAUTHORIZED_ERROR_COPY.body}
          scope="configuration-error"
          primary={retry}
        />
      );
    }

    const configure = showConfigureAction
      ? {
          label: CONFIGURE_PROVIDER_LABEL,
          onAction: () => void navigate({ to: "/settings/providers" }),
        }
      : undefined;

    // A credential-caused load failure is a setup condition, not an app fault:
    // the gate turns warning-toned and says what to reconnect.
    if (error && isCredentialSetupError(error)) {
      return (
        <FailureView
          title={CREDENTIAL_ERROR_COPY.title}
          message={CREDENTIAL_ERROR_COPY.body}
          tone="warning"
          scope="configuration-error"
          primary={retry}
          recovery={configure}
        />
      );
    }

    // Retry leads, but it dead-ends when the configuration cannot load at all —
    // e.g. missing credential files — so the providers screen stays reachable.
    const message = showConfigureAction
      ? "Diffgazer could not load the current configuration. Retry the request or configure a provider."
      : "Diffgazer could not load the current configuration. Try again.";
    return (
      <FailureView
        title={CONFIGURATION_ERROR_COPY.title}
        message={message}
        scope="configuration-error"
        primary={retry}
        recovery={configure}
      />
    );
  }

  return <CenteredStatus>Loading configuration...</CenteredStatus>;
}

function getNoticeCopy(error: Error): { tone: "warning" | "error"; title: string; body: string } {
  if (isUnauthorizedError(error)) {
    return { tone: "error", ...UNAUTHORIZED_ERROR_COPY };
  }
  if (isCredentialSetupError(error)) {
    return {
      tone: "warning",
      title: CREDENTIAL_ERROR_COPY.title,
      body: "The saved provider credential could not be read. Re-enter the API key below, or retry.",
    };
  }
  return {
    tone: "error",
    title: CONFIGURATION_ERROR_COPY.title,
    body: "Diffgazer could not load the current configuration. Provider setup below still works — re-enter credentials, or retry once the server responds.",
  };
}

/**
 * Non-blocking form of the configuration-error gate for the screen recovery
 * routes to: the providers page must keep its setup surface interactive when
 * the configuration failed to load, so the failure renders as a compact inline
 * callout above the content instead of replacing it. Warning-toned when the
 * stored credential is the cause; error-toned only for genuine load failures.
 */
export function ConfigurationErrorNotice({
  error,
  actionRef,
  onActionFocus,
}: {
  error: Error;
  /** Lets the host page pull the Retry action into its managed focus cycle. */
  actionRef?: Ref<HTMLButtonElement>;
  onActionFocus?: () => void;
}) {
  const { refresh } = useConfigActions();
  const copy = getNoticeCopy(error);

  return (
    // Compact centered box: bounded to the app's standard column width
    // (max-w-2xl, as in layout/card.tsx) rather than spanning the panes
    // container below, with tighter block padding than the Callout default
    // and an explicit margin separating it from that container.
    <Callout tone={copy.tone} live className="mx-auto mb-4 w-full max-w-2xl shrink-0 py-2">
      <Callout.Title>{copy.title}</Callout.Title>
      <Callout.Content>{copy.body}</Callout.Content>
      {/* Deliberate placement, not grid auto-flow: from md the action column
          sits right of the text block and centers vertically across both text
          rows; below md it stacks under the body where the notice is in the
          page's normal scroll flow. */}
      <Button
        ref={actionRef}
        variant="outline"
        size="sm"
        bracket
        className="col-start-1 row-start-3 mt-1 justify-self-start md:col-start-2 md:row-start-1 md:row-end-3 md:mt-0 md:self-center"
        onFocus={onActionFocus}
        onClick={() => void refresh()}
      >
        Retry
      </Button>
    </Callout>
  );
}
