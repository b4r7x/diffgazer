'use client';

import { useState } from 'react';
import type { TrustCapabilities } from '@repo/schemas';

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

interface UseTrustDialogFormOptions {
  onTrust: (capabilities: TrustCapabilities) => void;
  onClose: () => void;
}

export function useTrustDialogForm({ onTrust, onClose }: UseTrustDialogFormOptions) {
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);

  const handleSubmit = () => {
    onTrust(capabilities);
    onClose();
  };

  return {
    capabilities,
    setCapabilities,
    handleSubmit,
  };
}
