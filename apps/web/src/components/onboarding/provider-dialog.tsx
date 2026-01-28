'use client';

import { useState } from 'react';
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
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');

  const handleComplete = () => {
    onComplete(provider, apiKey);
    onOpenChange(false);
  };

  const isValid = provider === 'ollama' || apiKey.trim().length > 0;

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
          <Button variant="primary" onClick={handleComplete} disabled={!isValid}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
