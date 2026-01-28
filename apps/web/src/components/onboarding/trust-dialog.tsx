'use client';

import type { TrustCapabilities } from '@repo/schemas';
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
import { TrustPermissionsContent } from '../settings/trust-permissions-content';
import { useTrustDialogForm } from './use-trust-dialog-form';

interface TrustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  directory: string;
  onTrust: (capabilities: TrustCapabilities) => void;
}

export function TrustDialog({
  open,
  onOpenChange,
  directory,
  onTrust,
}: TrustDialogProps) {
  const { capabilities, setCapabilities, handleSubmit } = useTrustDialogForm({
    onTrust,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trust Project</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <TrustPermissionsContent
            directory={directory}
            value={capabilities}
            onChange={setCapabilities}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit}>
            Trust Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
