'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { ProviderSelectorContent } from '../settings/provider-selector-content';
import { useProviderDialogForm } from './use-provider-dialog-form';

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (provider: string, apiKey: string) => void;
}

export function ProviderDialog({
  open,
  onOpenChange,
  onComplete,
}: ProviderDialogProps) {
  const { provider, setProvider, apiKey, setApiKey, isValid, handleSubmit } = useProviderDialogForm({
    onComplete,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure AI Provider</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <ProviderSelectorContent
            provider={provider}
            onProviderChange={setProvider}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} disabled={!isValid}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
