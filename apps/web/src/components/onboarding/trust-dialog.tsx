'use client';

import { useState } from 'react';
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

interface TrustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  directory: string;
  onTrust: (capabilities: TrustCapabilities) => void;
}

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

export function TrustDialog({
  open,
  onOpenChange,
  directory,
  onTrust,
}: TrustDialogProps) {
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);

  const handleTrust = () => {
    onTrust(capabilities);
    onOpenChange(false);
  };

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
          <Button variant="primary" onClick={handleTrust}>
            Trust Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
