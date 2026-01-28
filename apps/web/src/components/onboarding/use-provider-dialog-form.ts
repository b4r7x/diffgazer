'use client';

import { useState } from 'react';

interface UseProviderDialogFormOptions {
  onComplete: (provider: string, apiKey: string) => void;
  onClose: () => void;
}

export function useProviderDialogForm({ onComplete, onClose }: UseProviderDialogFormOptions) {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');

  const isValid = provider === 'ollama' || apiKey.trim().length > 0;

  const handleSubmit = () => {
    onComplete(provider, apiKey);
    onClose();
  };

  return {
    provider,
    setProvider,
    apiKey,
    setApiKey,
    isValid,
    handleSubmit,
  };
}
