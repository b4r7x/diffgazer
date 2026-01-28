'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { NavigationList, NavigationListItem } from '@/components/ui/navigation-list';
import { cn } from '@/lib/utils';
import { useKey } from '@/hooks/keyboard';

type SettingsSection = 'list' | 'trust' | 'provider' | 'credentials';

interface TrustCapabilities {
  readFiles: boolean;
  readGit: boolean;
  runCommands: boolean;
}

interface Provider {
  id: string;
  name: string;
  status: 'configured' | 'needs-key';
  defaultModel: string;
}

const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', status: 'needs-key', defaultModel: 'gpt-4o' },
  { id: 'gemini', name: 'Gemini', status: 'configured', defaultModel: 'gemini-1.5-pro' },
  { id: 'anthropic', name: 'Anthropic', status: 'needs-key', defaultModel: 'claude-3.5-sonnet' },
  { id: 'openrouter', name: 'OpenRouter', status: 'needs-key', defaultModel: 'auto' },
];

const TRUST_OPTIONS = [
  { key: 'readFiles', label: 'Allow reading repository files' },
  { key: 'readGit', label: 'Allow reading git metadata' },
  { key: 'runCommands', label: 'Allow running commands (tests/lint)' },
] as const;

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  directory?: string;
  initialCapabilities?: TrustCapabilities;
  initialProvider?: string;
  onSaveCapabilities?: (capabilities: TrustCapabilities) => void;
  onSaveProvider?: (providerId: string, apiKey: string) => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] text-[--tui-fg] opacity-50 uppercase tracking-widest font-semibold mb-2">
      {children}
    </h3>
  );
}

function Divider() {
  return (
    <div className="w-full text-[--tui-border] overflow-hidden whitespace-nowrap select-none text-xs tracking-tighter opacity-50 my-4">
      {'─'.repeat(80)}
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  directory = process.cwd?.() || '~/project',
  initialCapabilities = { readFiles: true, readGit: true, runCommands: false },
  initialProvider = 'gemini',
  onSaveCapabilities,
  onSaveProvider,
}: SettingsDialogProps) {
  const [section, setSection] = React.useState<SettingsSection>('list');
  const [capabilities, setCapabilities] = React.useState<TrustCapabilities>(initialCapabilities);
  const [selectedProvider, setSelectedProvider] = React.useState(initialProvider);
  const [apiKey, setApiKey] = React.useState('');
  const [focusedCapabilityIndex, setFocusedCapabilityIndex] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      setSection('list');
      setCapabilities(initialCapabilities);
      setSelectedProvider(initialProvider);
      setApiKey('');
      setFocusedCapabilityIndex(0);
    }
  }, [open, initialCapabilities, initialProvider]);

  useKey('ArrowUp', () => {
    if (section === 'trust') {
      setFocusedCapabilityIndex((prev) => (prev > 0 ? prev - 1 : TRUST_OPTIONS.length - 1));
    }
  }, { enabled: open && section === 'trust' });

  useKey('ArrowDown', () => {
    if (section === 'trust') {
      setFocusedCapabilityIndex((prev) => (prev < TRUST_OPTIONS.length - 1 ? prev + 1 : 0));
    }
  }, { enabled: open && section === 'trust' });

  useKey(' ', () => {
    if (section === 'trust') {
      const key = TRUST_OPTIONS[focusedCapabilityIndex].key;
      setCapabilities((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }, { enabled: open && section === 'trust' });

  const toggleCapability = (key: keyof TrustCapabilities) => {
    setCapabilities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveTrust = () => {
    onSaveCapabilities?.(capabilities);
    setSection('list');
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setSection('credentials');
  };

  const handleSaveCredentials = () => {
    onSaveProvider?.(selectedProvider, apiKey);
    setSection('list');
    setApiKey('');
  };

  const getProviderBadge = (status: string) => {
    if (status === 'configured') {
      return <span className="text-xs text-[--tui-green]">[configured]</span>;
    }
    return <span className="text-xs text-[--tui-yellow]">[needs key]</span>;
  };

  const renderSectionList = () => (
    <div className="flex flex-col gap-4">
      <SectionHeader>Settings Sections</SectionHeader>
      <NavigationList
        value={undefined}
        onValueChange={(value) => setSection(value as SettingsSection)}
      >
        <NavigationListItem
          value="trust"
          label="Trust & Permissions"
          description="Manage directory trust and capabilities"
        />
        <NavigationListItem
          value="provider"
          label="AI Provider"
          description="Select and configure AI provider"
          badge={getProviderBadge(PROVIDERS.find((p) => p.id === selectedProvider)?.status || 'needs-key')}
        />
      </NavigationList>

      <Divider />

      <div className="flex flex-col gap-2">
        <SectionHeader>Current Configuration</SectionHeader>
        <div className="text-sm space-y-1">
          <div>
            <span className="text-[--tui-fg]/50">Provider: </span>
            <span className="text-[--tui-fg]">
              {PROVIDERS.find((p) => p.id === selectedProvider)?.name || 'Not configured'}
            </span>
          </div>
          <div>
            <span className="text-[--tui-fg]/50">Directory: </span>
            <span className="text-[--tui-fg] text-xs font-mono">{directory}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrustSection = () => (
    <div className="flex flex-col gap-4">
      <SectionHeader>Trust Capabilities</SectionHeader>
      <p className="text-sm text-[--tui-fg]/70 mb-2">
        Select which capabilities to grant for this directory:
      </p>

      <div className="flex flex-col">
        {TRUST_OPTIONS.map((item, index) => (
          <Checkbox
            key={item.key}
            checked={capabilities[item.key]}
            onCheckedChange={() => toggleCapability(item.key)}
            label={item.label}
            focused={focusedCapabilityIndex === index}
          />
        ))}
      </div>

      <Divider />

      <div className="flex flex-col gap-2">
        <SectionHeader>Current Directory</SectionHeader>
        <div className="text-sm text-[--tui-fg] font-mono break-all">
          {directory}
        </div>
      </div>
    </div>
  );

  const renderProviderSection = () => (
    <div className="flex flex-col gap-4">
      <SectionHeader>Select AI Provider</SectionHeader>
      <NavigationList value={selectedProvider} onValueChange={handleProviderSelect}>
        {PROVIDERS.map((provider) => (
          <NavigationListItem
            key={provider.id}
            value={provider.id}
            label={provider.name}
            description={`Default model: ${provider.defaultModel}`}
            badge={getProviderBadge(provider.status)}
          />
        ))}
      </NavigationList>
    </div>
  );

  const renderCredentialsSection = () => {
    const provider = PROVIDERS.find((p) => p.id === selectedProvider);
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader>API Credentials</SectionHeader>
        <div className="text-sm mb-2">
          <span className="text-[--tui-fg]/50">Provider: </span>
          <span className="text-[--tui-fg] font-bold">{provider?.name}</span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-[--tui-fg]/70 uppercase tracking-wide">
            API Key
          </label>
          <Input
            type="password"
            placeholder="Enter your API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="max-w-md"
          />
        </div>

        <p className="text-xs text-[--tui-fg]/50 mt-2">
          Your API key will be stored securely in the local configuration.
        </p>
      </div>
    );
  };

  const renderFooter = () => {
    if (section === 'list') {
      return (
        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>
      );
    }

    if (section === 'trust') {
      return (
        <>
          <Button variant="secondary" onClick={() => setSection('list')}>
            Back
          </Button>
          <Button variant="primary" onClick={handleSaveTrust}>
            Save
          </Button>
        </>
      );
    }

    if (section === 'provider') {
      return (
        <Button variant="secondary" onClick={() => setSection('list')}>
          Back
        </Button>
      );
    }

    if (section === 'credentials') {
      return (
        <>
          <Button variant="secondary" onClick={() => setSection('provider')}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveCredentials}
            disabled={!apiKey.trim()}
          >
            Save
          </Button>
        </>
      );
    }

    return null;
  };

  const getSectionTitle = () => {
    switch (section) {
      case 'trust':
        return 'Trust & Permissions';
      case 'provider':
        return 'Select AI Provider';
      case 'credentials':
        return 'API Credentials';
      default:
        return 'Settings';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[580px]">
        <DialogHeader>
          <DialogTitle>{getSectionTitle()}</DialogTitle>
          <DialogClose className="text-[--tui-fg] hover:text-[--tui-blue] transition-colors text-sm" />
        </DialogHeader>
        <DialogBody className="min-h-[300px]">
          {section === 'list' && renderSectionList()}
          {section === 'trust' && renderTrustSection()}
          {section === 'provider' && renderProviderSection()}
          {section === 'credentials' && renderCredentialsSection()}
        </DialogBody>
        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
