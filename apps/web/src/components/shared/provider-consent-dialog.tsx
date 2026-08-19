import {
  describeAcceptedProviderConsent,
  PROVIDER_CONSENT_NOTICE,
  PROVIDER_CONSENT_PRIVACY_URL,
  PROVIDER_CONSENT_TEXT,
  type ProviderConsent,
} from "@diffgazer/core/schemas/config";
import { useActionRowNavigation, useKeyboardContext } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { composeRefs } from "@diffgazer/ui/lib/compose-refs";
import { useEffectEvent, useLayoutEffect, useRef } from "react";

export interface ProviderConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The recorded consent; null offers the acceptance, a record reads it back. */
  consent: ProviderConsent | null;
  /** True when accepting continues an action the gate held back, which the button then says. */
  continues: boolean;
  isAccepting: boolean;
  /** The last failed acceptance, shown inside the notice. */
  error: string | null;
  onAccept: () => void;
}

/**
 * The one provider consent, as an alert dialog: it interrupts exactly the
 * action that would send repository content, so Escape and Not now cancel that
 * action alone and leave the app usable. Once accepted the same dialog reads
 * the notice back with the acceptance date and a single Close.
 */
export function ProviderConsentDialog({
  open,
  onOpenChange,
  consent,
  continues,
  isAccepting,
  error,
  onAccept,
}: ProviderConsentDialogProps) {
  // The one confirming action of the open footer: Accept, or Close once
  // accepted. Initial focus lands on it, per APG, so Enter means Accept (or
  // Close), not "open the privacy notes in a new tab".
  const primaryRef = useRef<HTMLButtonElement>(null);
  const keyboard = useKeyboardContext();
  // The page's own accelerators and the global q/s/h stand down while the
  // notice owns the keys (a `-dialog` scope is what GlobalShortcuts suppresses
  // on). Pushed imperatively: the notice mounts with the app shell, before any
  // routed page, so a declarative useScope — ranked by mount order — would sit
  // below every page mounted after it. The public pushScope is re-created per
  // render, hence the effect event rather than a dependency.
  const pushNoticeScope = useEffectEvent(() => keyboard.pushScope("provider-consent-dialog"));
  useLayoutEffect(() => {
    if (!open) return;
    return pushNoticeScope();
  }, [open]);
  // The open footer is an action row like every other dialog footer: Left/Right
  // move between Not now and Accept, Enter activates the focused one. Bound to
  // the pushed scope explicitly, since implicit ordering would rank this hook
  // below the routed page (see above).
  const footer = useActionRowNavigation({
    enabled: open && consent === null,
    scope: "provider-consent-dialog",
    actionCount: 2,
    disabledActions: [isAccepting, false],
    defaultZone: "actions",
    defaultIndex: 1,
    canExitActions: false,
    onAction: (index) => {
      if (index === 0) handleOpenChange(false);
      else if (!isAccepting) onAccept();
    },
  });
  const acceptProps = footer.getActionProps(1);

  // The notice stays mounted with the app shell, so the row's focused index
  // would otherwise outlive a decline and pull the next open onto Not now.
  function handleOpenChange(next: boolean) {
    if (!next) footer.reset(1);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        role="alertdialog"
        // Narrower than the default md (matches the API key dialog), but still
        // wide enough for the footer's hints and both actions on one row.
        className="max-w-xl"
        closeIcon={false}
        closeOnBackdropClick={false}
        initialFocus={primaryRef}
        onEscapeKeyDown={(event) => {
          if (isAccepting) event.preventDefault();
        }}
      >
        {/* The title keeps its line to itself; the one-line description sits under it. */}
        <DialogHeader className="flex-col items-start gap-0.5 py-2.5">
          <DialogTitle>{PROVIDER_CONSENT_NOTICE.title}</DialogTitle>
          <DialogDescription>
            {consent ? describeAcceptedProviderConsent(consent) : PROVIDER_CONSENT_NOTICE.askedOnce}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm leading-relaxed">{PROVIDER_CONSENT_TEXT}</p>
          <Button
            as="a"
            variant="link"
            size="sm"
            // Flush with the paragraph above: the link is a line of the notice, not a button in a row.
            className="px-0"
            href={PROVIDER_CONSENT_PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
          >
            Privacy notes ↗
          </Button>
          {error !== null ? (
            <p role="alert" className="text-sm text-error-text">
              {error}
            </p>
          ) : null}
        </DialogBody>
        {consent ? (
          <DialogFooter hints={[{ key: "Esc", label: PROVIDER_CONSENT_NOTICE.close }]}>
            <DialogClose ref={primaryRef} variant="outline" size="sm" bracket>
              {PROVIDER_CONSENT_NOTICE.close}
            </DialogClose>
          </DialogFooter>
        ) : (
          <DialogFooter
            hints={[
              { key: "Enter", label: PROVIDER_CONSENT_NOTICE.accept },
              { key: "Esc", label: PROVIDER_CONSENT_NOTICE.notNow },
            ]}
          >
            <DialogClose
              {...footer.getActionProps(0)}
              variant="ghost"
              size="sm"
              bracket
              disabled={isAccepting}
            >
              {PROVIDER_CONSENT_NOTICE.notNow}
            </DialogClose>
            <DialogAction
              {...acceptProps}
              ref={composeRefs(primaryRef, acceptProps.ref)}
              size="sm"
              loading={isAccepting}
              onClick={(event) => {
                // The dialog closes once the consent is on record, not on the click.
                event.preventDefault();
                onAccept();
              }}
            >
              {continues
                ? PROVIDER_CONSENT_NOTICE.acceptAndContinue
                : PROVIDER_CONSENT_NOTICE.accept}
            </DialogAction>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
