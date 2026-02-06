'use client';

import { RadioGroup, RadioGroupItem, Input } from '@/components/ui/form';

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'zai', label: 'Z.AI' },
  { value: 'zai-coding', label: 'Z.AI Coding Plan' },
  { value: 'openrouter', label: 'OpenRouter' },
] as const;

export interface ProviderSelectorContentProps {
  provider: string;
  onProviderChange: (provider: string) => void;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
  showApiKey?: boolean;
}

export function ProviderSelectorContent({
  provider,
  onProviderChange,
  apiKey = '',
  onApiKeyChange,
  showApiKey = true,
}: ProviderSelectorContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-mono text-[--tui-fg] mb-2">
          Select AI Provider:
        </div>
        <RadioGroup value={provider} onValueChange={onProviderChange}>
          {PROVIDERS.map((p) => (
            <RadioGroupItem key={p.value} value={p.value} label={p.label} />
          ))}
        </RadioGroup>
      </div>

      {showApiKey && (
        <div>
          <label className="text-sm font-mono text-[--tui-fg] mb-2 block">
            API KEY:
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange?.(e.target.value)}
            placeholder="Enter your API key"
          />
        </div>
      )}
    </div>
  );
}
