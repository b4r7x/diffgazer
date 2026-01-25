# Phase 4: Settings and Onboarding Integration

## Overview

Wire settings UI to real configuration data and complete the onboarding wizard flow.

**Priority:** HIGH
**Dependencies:** Phases 1-3 complete (streaming works)

---

## Context

### Current Problems
1. SettingsView shows "[Not Configured]" for all providers
2. Theme/controls changes don't persist
3. Onboarding flow incomplete (missing trust step)
4. Settings logic scattered across multiple files

### Goal
- Settings show actual provider status
- Changes persist to storage
- Complete onboarding flow: Trust → Theme → Provider → Credentials → Controls → Summary

---

## Agent 4.1: Create Provider Status Endpoint

```
subagent_type: "backend-development:backend-architect"

Task: Add endpoint to return configured provider status.

Read first:
- apps/server/src/api/routes/config.ts
- packages/core/src/storage/config.ts

Modify: apps/server/src/api/routes/config.ts

Add GET /config/providers endpoint:

```typescript
import { AI_PROVIDERS } from '@repo/schemas';
import { getStoredConfig } from '@repo/core/storage';

interface ProviderStatus {
  provider: string;
  configured: boolean;
  model?: string;
  tier?: 'free' | 'paid';
}

interface ProvidersResponse {
  providers: ProviderStatus[];
  activeProvider: string | null;
  activeModel: string | null;
}

configRouter.get('/providers', async (c) => {
  // Get stored config
  const config = await getStoredConfig();

  // Check which providers have API keys configured
  const providers: ProviderStatus[] = AI_PROVIDERS.map(provider => {
    const envKey = getEnvKeyName(provider);
    const hasKey = Boolean(process.env[envKey]);

    return {
      provider,
      configured: hasKey,
      model: config?.provider === provider ? config.model : undefined,
      tier: hasKey ? getModelTier(provider, config?.model) : undefined,
    };
  });

  return c.json<ProvidersResponse>({
    providers,
    activeProvider: config?.provider ?? null,
    activeModel: config?.model ?? null,
  });
});

// Helper functions
function getEnvKeyName(provider: string): string {
  const mapping: Record<string, string> = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  };
  return mapping[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}

function getModelTier(provider: string, model?: string): 'free' | 'paid' {
  // Simple heuristic - can be expanded
  if (provider === 'gemini' && model?.includes('flash')) return 'free';
  return 'paid';
}
```

Steps:
1. Read current config route
2. Add /providers endpoint
3. Check env vars for API keys
4. Return status array
5. Run: npm run type-check

Output: Provider status endpoint
```

---

## Agent 4.2: Create useProviderStatus Hook

```
subagent_type: "react-component-architect"

Task: Create hook to fetch and manage provider status.

Create: apps/cli/src/hooks/use-provider-status.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@repo/api';

interface ProviderStatus {
  provider: string;
  configured: boolean;
  model?: string;
  tier?: 'free' | 'paid';
}

interface ProvidersState {
  providers: ProviderStatus[];
  activeProvider: string | null;
  activeModel: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useProviderStatus() {
  const [state, setState] = useState<ProvidersState>({
    providers: [],
    activeProvider: null,
    activeModel: null,
    isLoading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await fetchApi<{
        providers: ProviderStatus[];
        activeProvider: string | null;
        activeModel: string | null;
      }>('/config/providers');

      if (result.ok) {
        setState({
          providers: result.value.providers,
          activeProvider: result.value.activeProvider,
          activeModel: result.value.activeModel,
          isLoading: false,
          error: null,
        });
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: new Error(result.error.message),
        }));
      }
    } catch (e) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e : new Error('Unknown error'),
      }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const refresh = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    ...state,
    refresh,
    configuredProviders: state.providers.filter(p => p.configured),
    unconfiguredProviders: state.providers.filter(p => !p.configured),
  };
}
```

Steps:
1. Create hook file
2. Add fetch logic
3. Add computed properties
4. Export from hooks/index.ts
5. Run: npm run type-check

Output: Provider status hook
```

---

## Agent 4.3: Wire SettingsView to Real Data

```
subagent_type: "react-component-architect"

Task: Update settings view to use real configuration data.

Read first:
- apps/cli/src/app/screens/settings-screen.tsx (or views/settings-view.tsx)
- apps/cli/src/hooks/use-settings.ts

Modify: apps/cli/src/app/screens/settings-screen.tsx

```tsx
import { Box, Text } from 'ink';
import { useProviderStatus } from '@/hooks/use-provider-status';
import { useSettings } from '@/hooks/use-settings';
import { SelectList } from '@/components/ui/select-list';
import { Badge } from '@/components/ui/badge';

export function SettingsScreen() {
  const {
    providers,
    activeProvider,
    activeModel,
    isLoading: providersLoading,
  } = useProviderStatus();

  const {
    settings,
    updateSettings,
    isLoading: settingsLoading,
  } = useSettings();

  const isLoading = providersLoading || settingsLoading;

  if (isLoading) {
    return (
      <Box padding={1}>
        <Text dimColor>Loading settings...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Settings</Text>

      {/* Provider Section */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>AI Provider</Text>
        <Box flexDirection="column" marginLeft={2}>
          {providers.map(p => (
            <Box key={p.provider} gap={2}>
              <Text>{p.provider}</Text>
              {p.configured ? (
                <Badge color="green">Configured</Badge>
              ) : (
                <Badge color="gray">Not configured</Badge>
              )}
              {p.provider === activeProvider && (
                <Badge color="cyan">Active</Badge>
              )}
            </Box>
          ))}
        </Box>
        {activeModel && (
          <Text dimColor marginTop={1}>
            Model: {activeModel}
          </Text>
        )}
      </Box>

      {/* Theme Section */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>Theme</Text>
        <SelectList
          items={[
            { label: 'Auto', value: 'auto' },
            { label: 'Dark', value: 'dark' },
            { label: 'Light', value: 'light' },
            { label: 'Terminal', value: 'terminal' },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
      </Box>

      {/* Controls Section */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>Controls Mode</Text>
        <SelectList
          items={[
            { label: 'Menu (arrow keys)', value: 'menu' },
            { label: 'Keys (vim-style)', value: 'keys' },
          ]}
          value={settings.controlsMode}
          onChange={(controlsMode) => updateSettings({ controlsMode })}
        />
      </Box>

      {/* Default Lenses */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>Default Lenses</Text>
        <Text dimColor>{settings.defaultLenses.join(', ')}</Text>
      </Box>
    </Box>
  );
}
```

Steps:
1. Import hooks
2. Replace placeholder data
3. Wire onChange handlers
4. Test settings changes persist
5. Run: npm run type-check

Output: Settings show real data
```

---

## Agent 4.4: Create Trust Step Component

```
subagent_type: "react-component-architect"

Task: Create the Trust step for the onboarding wizard.

Read first:
- packages/schemas/src/settings.ts (TrustConfig, TrustCapabilities)
- apps/cli/src/components/wizard/

Create: apps/cli/src/components/wizard/trust-step.tsx

```tsx
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ToggleList } from '@/components/ui/toggle-list';
import type { TrustCapabilities, TrustMode } from '@repo/schemas';

interface TrustStepProps {
  repoRoot: string;
  onComplete: (config: {
    capabilities: TrustCapabilities;
    trustMode: TrustMode;
  }) => void;
  onSkip: () => void;
}

export function TrustStep({ repoRoot, onComplete, onSkip }: TrustStepProps) {
  const [capabilities, setCapabilities] = useState<TrustCapabilities>({
    readFiles: true,
    readGit: true,
    runCommands: false,
  });

  const [selectedAction, setSelectedAction] = useState<'trust' | 'once' | 'skip'>('trust');

  useInput((input, key) => {
    if (key.return) {
      if (selectedAction === 'skip') {
        onSkip();
      } else {
        onComplete({
          capabilities,
          trustMode: selectedAction === 'trust' ? 'persistent' : 'session',
        });
      }
    }

    if (input === '1') setSelectedAction('trust');
    if (input === '2') setSelectedAction('once');
    if (input === '3') setSelectedAction('skip');

    if (input === 'r') {
      setCapabilities(prev => ({ ...prev, readFiles: !prev.readFiles }));
    }
    if (input === 'g') {
      setCapabilities(prev => ({ ...prev, readGit: !prev.readGit }));
    }
    if (input === 'c') {
      setCapabilities(prev => ({ ...prev, runCommands: !prev.runCommands }));
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Do you trust this directory?</Text>
      <Text color="cyan">{repoRoot}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>Stargazer will:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>
            <Text color={capabilities.readFiles ? 'green' : 'gray'}>
              {capabilities.readFiles ? '●' : '○'}
            </Text>
            {' '}[r] Read repository files
          </Text>
          <Text>
            <Text color={capabilities.readGit ? 'green' : 'gray'}>
              {capabilities.readGit ? '●' : '○'}
            </Text>
            {' '}[g] Read git metadata
          </Text>
          <Text>
            <Text color={capabilities.runCommands ? 'green' : 'gray'}>
              {capabilities.runCommands ? '●' : '○'}
            </Text>
            {' '}[c] Run commands (tests/lint)
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>Stargazer will NOT:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text dimColor>• Send code anywhere except to selected AI provider</Text>
          <Text dimColor>• Write files unless you apply a patch</Text>
          <Text dimColor>• Run commands without explicit approval</Text>
        </Box>
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color={selectedAction === 'trust' ? 'cyan' : 'gray'}>
          [1] Trust & Continue
        </Text>
        <Text color={selectedAction === 'once' ? 'cyan' : 'gray'}>
          [2] Trust Once
        </Text>
        <Text color={selectedAction === 'skip' ? 'cyan' : 'gray'}>
          [3] Skip
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press 1/2/3 to select, Enter to confirm</Text>
      </Box>
    </Box>
  );
}
```

Steps:
1. Create trust-step.tsx
2. Add capability toggles
3. Add trust mode selection
4. Wire keyboard input
5. Export from wizard/index.ts
6. Run: npm run type-check

Output: Trust step component
```

---

## Agent 4.5: Complete Onboarding Flow

```
subagent_type: "react-component-architect"

Task: Wire complete onboarding wizard with all steps.

Read first:
- apps/cli/src/app/screens/onboarding-screen.tsx
- apps/cli/src/components/wizard/

Modify: apps/cli/src/app/screens/onboarding-screen.tsx

```tsx
import { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { TrustStep } from '@/components/wizard/trust-step';
import { ThemeStep } from '@/components/wizard/theme-step';
import { ProviderStep } from '@/components/wizard/provider-step';
import { CredentialsStep } from '@/components/wizard/credentials-step';
import { ControlsStep } from '@/components/wizard/controls-step';
import { SummaryStep } from '@/components/wizard/summary-step';
import { HeaderBrand } from '@/components/ui/header-brand';
import type {
  TrustCapabilities,
  TrustMode,
  Theme,
  AIProvider,
  ControlsMode,
} from '@repo/schemas';

type WizardStep = 'trust' | 'theme' | 'provider' | 'credentials' | 'controls' | 'summary';

interface WizardState {
  step: WizardStep;
  trust?: {
    capabilities: TrustCapabilities;
    trustMode: TrustMode;
  };
  theme: Theme;
  provider?: AIProvider;
  apiKey?: string;
  controlsMode: ControlsMode;
}

interface OnboardingScreenProps {
  repoRoot: string;
  onComplete: () => void;
}

const STEP_ORDER: WizardStep[] = ['trust', 'theme', 'provider', 'credentials', 'controls', 'summary'];

export function OnboardingScreen({ repoRoot, onComplete }: OnboardingScreenProps) {
  const [state, setState] = useState<WizardState>({
    step: 'trust',
    theme: 'auto',
    controlsMode: 'menu',
  });

  const currentStepIndex = STEP_ORDER.indexOf(state.step);
  const totalSteps = STEP_ORDER.length;

  const goToStep = useCallback((step: WizardStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setState(prev => ({ ...prev, step: STEP_ORDER[nextIndex] }));
    }
  }, [currentStepIndex]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setState(prev => ({ ...prev, step: STEP_ORDER[prevIndex] }));
    }
  }, [currentStepIndex]);

  // Handle trust step
  const handleTrustComplete = useCallback((trust: WizardState['trust']) => {
    setState(prev => ({ ...prev, trust }));
    goNext();
  }, [goNext]);

  const handleTrustSkip = useCallback(() => {
    goNext();
  }, [goNext]);

  // Handle theme step
  const handleThemeSelect = useCallback((theme: Theme) => {
    setState(prev => ({ ...prev, theme }));
    goNext();
  }, [goNext]);

  // Handle provider step
  const handleProviderSelect = useCallback((provider: AIProvider) => {
    setState(prev => ({ ...prev, provider }));
    goNext();
  }, [goNext]);

  // Handle credentials step
  const handleCredentialsComplete = useCallback((apiKey: string) => {
    setState(prev => ({ ...prev, apiKey }));
    goNext();
  }, [goNext]);

  const handleCredentialsSkip = useCallback(() => {
    goNext();
  }, [goNext]);

  // Handle controls step
  const handleControlsSelect = useCallback((controlsMode: ControlsMode) => {
    setState(prev => ({ ...prev, controlsMode }));
    goNext();
  }, [goNext]);

  // Handle finish
  const handleFinish = useCallback(async () => {
    // Save configuration
    await saveOnboardingConfig(state);
    onComplete();
  }, [state, onComplete]);

  const renderStep = () => {
    switch (state.step) {
      case 'trust':
        return (
          <TrustStep
            repoRoot={repoRoot}
            onComplete={handleTrustComplete}
            onSkip={handleTrustSkip}
          />
        );
      case 'theme':
        return (
          <ThemeStep
            value={state.theme}
            onSelect={handleThemeSelect}
            onBack={goBack}
          />
        );
      case 'provider':
        return (
          <ProviderStep
            value={state.provider}
            onSelect={handleProviderSelect}
            onBack={goBack}
          />
        );
      case 'credentials':
        return (
          <CredentialsStep
            provider={state.provider!}
            onComplete={handleCredentialsComplete}
            onSkip={handleCredentialsSkip}
            onBack={goBack}
          />
        );
      case 'controls':
        return (
          <ControlsStep
            value={state.controlsMode}
            onSelect={handleControlsSelect}
            onBack={goBack}
          />
        );
      case 'summary':
        return (
          <SummaryStep
            config={state}
            onFinish={handleFinish}
            onBack={goBack}
          />
        );
    }
  };

  return (
    <Box flexDirection="column">
      <HeaderBrand />
      <Box paddingX={2}>
        <Text dimColor>
          Setup • Step {currentStepIndex + 1}/{totalSteps}
        </Text>
      </Box>
      <Box marginTop={1}>
        {renderStep()}
      </Box>
    </Box>
  );
}

// Helper to save config
async function saveOnboardingConfig(state: WizardState): Promise<void> {
  // Save trust config
  if (state.trust) {
    await saveTrustConfig(state.trust);
  }

  // Save settings
  await saveSettings({
    theme: state.theme,
    controlsMode: state.controlsMode,
  });

  // Save provider config
  if (state.provider && state.apiKey) {
    await saveProviderConfig({
      provider: state.provider,
      apiKey: state.apiKey,
    });
  }
}
```

Steps:
1. Define wizard state type
2. Add all step handlers
3. Implement step rendering
4. Add navigation (next/back)
5. Wire save on complete
6. Run: npm run type-check

Output: Complete onboarding wizard
```

---

## Agent 4.6: Update App to Check Onboarding Status

```
subagent_type: "react-component-architect"

Task: Check if onboarding is needed and route appropriately.

Read first:
- apps/cli/src/app/app.tsx

Modify: apps/cli/src/app/app.tsx

```tsx
import { useState, useEffect } from 'react';
import { Box } from 'ink';
import { OnboardingScreen } from '@/app/screens/onboarding-screen';
import { MainMenuView } from '@/app/views/main-menu-view';
import { useAppInit } from '@/features/app/hooks/use-app-init';

type AppScreen = 'loading' | 'onboarding' | 'main';

export function App() {
  const {
    isInitialized,
    needsOnboarding,
    repoRoot,
    error,
  } = useAppInit();

  const [screen, setScreen] = useState<AppScreen>('loading');

  useEffect(() => {
    if (!isInitialized) return;

    if (needsOnboarding) {
      setScreen('onboarding');
    } else {
      setScreen('main');
    }
  }, [isInitialized, needsOnboarding]);

  if (error) {
    return (
      <Box padding={1}>
        <Text color="red">Error: {error.message}</Text>
      </Box>
    );
  }

  if (screen === 'loading') {
    return (
      <Box padding={1}>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        repoRoot={repoRoot ?? process.cwd()}
        onComplete={() => setScreen('main')}
      />
    );
  }

  return <MainMenuView />;
}
```

Update useAppInit hook to check onboarding status:

```typescript
// apps/cli/src/features/app/hooks/use-app-init.ts

export function useAppInit() {
  const [state, setState] = useState({
    isInitialized: false,
    needsOnboarding: false,
    repoRoot: null as string | null,
    error: null as Error | null,
  });

  useEffect(() => {
    async function init() {
      try {
        // Check if git repo
        const repoRoot = await getGitRoot();

        // Check if has config
        const config = await getStoredConfig();
        const hasProvider = Boolean(config?.provider);

        // Check if trusted
        const trust = await getTrustConfig(repoRoot);
        const isTrusted = Boolean(trust);

        setState({
          isInitialized: true,
          needsOnboarding: !hasProvider || !isTrusted,
          repoRoot,
          error: null,
        });
      } catch (e) {
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: e instanceof Error ? e : new Error('Init failed'),
        }));
      }
    }

    init();
  }, []);

  return state;
}
```

Steps:
1. Update app.tsx with screen routing
2. Update useAppInit to check onboarding status
3. Test first-run experience
4. Run: npm run type-check

Output: App routes to onboarding when needed
```

---

## Validation Checklist

- [ ] /config/providers endpoint returns status
- [ ] useProviderStatus hook fetches data
- [ ] SettingsScreen shows real provider status
- [ ] Theme changes persist
- [ ] Controls mode changes persist
- [ ] TrustStep component works
- [ ] Onboarding wizard has all steps
- [ ] App detects need for onboarding
- [ ] After onboarding, goes to main menu
- [ ] Type check passes: npm run type-check
