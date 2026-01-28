'use client';

import { RadioGroup } from '../ui/radio-group';
import { Input } from '../ui/input';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Local (Ollama)' },
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
            <RadioGroup.Item key={p.value} value={p.value} label={p.label} />
          ))}
        </RadioGroup>
      </div>

      {showApiKey && provider !== 'ollama' && (
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
