import { isRedundantStatusSegment, type ProviderDisplayStatus } from "@diffgazer/core/providers";
import { Button } from "@diffgazer/ui/components/button";
import {
  StatusIndicator,
  type StatusIndicatorStatus,
} from "@diffgazer/ui/components/status-indicator";
import { cn } from "@diffgazer/ui/lib/utils";
import type { Ref } from "react";
import { DiffgazerWordmark, type WordmarkTier } from "./wordmark";

/**
 * Transport health as the header tells it. The lamp is the app's only status
 * light, so it reports the server first: a provider cannot be "Active" through
 * a dead connection.
 */
export type HeaderServerState = "live" | "retrying" | "offline";

interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  serverState?: HeaderServerState;
  onBack?: () => void;
  /** Shell-owned ref to the Back button, the target of in-page chrome hand-offs. */
  backButtonRef?: Ref<HTMLButtonElement>;
  wordmark?: WordmarkTier;
}

/**
 * StatusIndicator has no idle dot. Idle — still loading, or no provider yet —
 * takes the hollow offline dot, the same muted treatment the TUI header gives a
 * non-active provider. Nothing announces "offline": the real provider status is
 * the word the row renders. A ready provider is the one filled green dot; the
 * amber busy dot covers both failure and, at half tone, a pending check.
 */
const DOT_STATUS: Record<ProviderDisplayStatus["variant"], StatusIndicatorStatus> = {
  success: "online",
  warning: "offline",
  error: "busy",
  info: "busy",
  neutral: "offline",
};

/**
 * A pending readiness check shares the busy amber — StatusIndicator carries no
 * fourth dot — but must not read as loud as a failure, so it takes that amber at
 * half tone through the dot's own slot.
 */
const PENDING_DOT = "[&_[data-slot=status-indicator-dot]]:opacity-50";

/**
 * What the lamp says when the transport is not healthy. The word replaces the
 * provider status because that is the truth the user needs first, and the dot
 * carries the same state so the row is never colour-only.
 */
const SERVER_STATE: Record<
  HeaderServerState,
  { word: string | null; dot: StatusIndicatorStatus | null; aria: string }
> = {
  live: { word: null, dot: null, aria: "live" },
  retrying: { word: "Reconnecting", dot: "offline", aria: "reconnecting" },
  offline: { word: "Offline", dot: "busy", aria: "offline" },
};

export function Header({
  providerName,
  providerStatus,
  serverState = "live",
  onBack,
  backButtonRef,
  wordmark = "hero",
}: HeaderProps) {
  const server = SERVER_STATE[serverState];
  const statusWord = server.word ?? providerStatus.shortLabel;
  const showStatusWord = !isRedundantStatusSegment(providerName, statusWord);
  const dotStatus = server.dot ?? DOT_STATUS[providerStatus.variant];
  const isPending = serverState === "live" && providerStatus.variant === "info";

  return (
    <header className="relative shrink-0 p-4 pb-2">
      {/*
       * One grid for every tier. Below sm the cells auto-flow into the stacked
       * mobile shape — wordmark, back, status — and from sm up the explicit
       * placements pull back and wordmark onto a single row, with the status
       * chip lifted out of flow into the corner.
       */}
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div
          className={cn(
            "col-span-2 flex min-w-0 flex-col items-center sm:col-span-1 sm:col-start-2 sm:row-start-1",
            wordmark === "hero" && "pt-4 md:pt-6",
          )}
        >
          <DiffgazerWordmark tier={wordmark} />
          {/* Hero tiers keep the old full-banner rhythm — the ~48px air under the
              art used to be blank figlet rows — while dense working headers stay
              tight. */}
          <div
            className={cn(
              "text-center text-muted-foreground select-none",
              wordmark === "hero" ? "mt-6 text-xs sm:mt-12 sm:text-sm" : "mt-4 text-2xs sm:text-xs",
            )}
          >
            ─ ✦ ─ ✧ ─
          </div>
        </div>

        <div className="col-start-1 sm:row-start-1 sm:self-start">
          {onBack ? (
            <Button
              ref={backButtonRef}
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
            >
              {/* The glyph is decoration: the five in-page hand-offs land here, and
                  the accessible name must be "Back", not "left arrow Back". */}
              <span aria-hidden="true">←</span> Back
            </Button>
          ) : null}
        </div>

        <StatusIndicator
          status={dotStatus}
          pulse={false}
          label={null}
          // An aria-label replaces the children for assistive tech, so the status
          // word has to be part of it; label={null} keeps StatusIndicator from
          // adding a second visible copy. It spells the status out in full where
          // the chip shows the one-word form.
          aria-label={`Provider: ${providerName}, ${providerStatus.label}; server ${server.aria}`}
          className={cn(
            "col-span-2 min-w-0 justify-self-start gap-1.5 text-foreground normal-case tracking-normal",
            // The corner chip shares its band with the centred wordmark, so it
            // takes a slice of the header rather than as much room as the model
            // name wants: past the cap the name ellipsizes and the art stays clear.
            "sm:absolute sm:right-4 sm:max-w-[21%] lg:max-w-[27%]",
            // Its top tracks the wordmark's top edge, which the hero tier pushes
            // down by its banner padding (pt-4 md:pt-6 above) — otherwise the chip
            // floats in the blank strip above the art instead of on its row.
            wordmark === "hero" ? "sm:top-8 md:top-10" : "sm:top-4",
            isPending && PENDING_DOT,
          )}
        >
          <span className="min-w-0 truncate">{providerName}</span>
          {/* Below sm the dot alone carries the state so the model name keeps the row;
              the row's aria-label carries the word at every width. */}
          {showStatusWord ? (
            <span className="shrink-0 sr-only sm:not-sr-only sm:whitespace-nowrap">
              <span aria-hidden="true">· </span>
              <span className={cn(serverState === "offline" && "text-error-text")}>
                {statusWord}
              </span>
            </span>
          ) : null}
        </StatusIndicator>
      </div>
    </header>
  );
}
