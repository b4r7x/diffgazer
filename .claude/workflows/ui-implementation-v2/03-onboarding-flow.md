# Phase 3: Complete Onboarding Flow

## Problem

Per gpt-convo.md (lines 943-1069), the onboarding flow should be:
```
TRUST_WIZARD → SETUP_WIZARD → HOME_MENU
```

Current implementation skips trust step and doesn't properly sequence wizard.

---

## Required Flow (from gpt-convo.md)

### Step 0: Trust Directory
- Show repo path
- Explain what stargazer will do:
  - Read repository files
  - Read git metadata
  - (Optional) Run commands
- Capabilities toggles:
  - [x] Allow reading repository files
  - [x] Allow reading git metadata
  - [ ] Allow running commands (default off)
- Actions: Trust & continue / Trust once / No (exit)

### Step 1: Theme
- Auto (recommended), Dark, Light, Terminal default

### Step 2: Provider
- List with configured status badge
- Badge: ✓ configured / • needs key

### Step 3: Credentials
- Methods: Paste now / Read from env / Read from stdin / Skip
- Store in keyring

### Step 4: Controls
- Menu mode (guided)
- Key mode (vim-ish)

### Step 5: Summary
- Review all choices
- Test connection option

---

## Task 3.1: Update Navigation Logic

**File:** `apps/cli/src/features/app/hooks/use-navigation.ts`

Add screen types:
```typescript
export type View =
  | "loading"
  | "trust-wizard"    // NEW
  | "onboarding"      // setup-wizard
  | "main"
  | "review"
  | "settings"
  | "sessions"
  | "review-history";

function determineInitialScreen(
  trust: TrustConfig | null,
  config: UserConfig | null
): View {
  if (!trust) return "trust-wizard";
  if (!config) return "onboarding";
  return "main";
}
```

---

## Task 3.2: Create Trust Wizard Screen

**File:** `apps/cli/src/app/screens/trust-wizard-screen.tsx`

```typescript
interface TrustWizardScreenProps {
  repoRoot: string;
  projectId: string;
  onTrust: (capabilities: TrustCapabilities, mode: "persistent" | "session") => void;
  onSkip: () => void;
}

export function TrustWizardScreen({
  repoRoot,
  projectId,
  onTrust,
  onSkip,
}: TrustWizardScreenProps) {
  // Uses TrustStep from components/wizard/
  return (
    <TrustStep
      mode="onboarding"
      currentStep={0}
      totalSteps={5}
      directoryPath={repoRoot}
      onSubmit={(capabilities) => onTrust(capabilities, "persistent")}
      onTrustOnce={(capabilities) => onTrust(capabilities, "session")}
      onBack={onSkip}
      isActive
    />
  );
}
```

---

## Task 3.3: Update Onboarding Screen

**File:** `apps/cli/src/app/screens/onboarding-screen.tsx`

The onboarding screen already exists but needs to:
1. Start from step 1 (after trust)
2. Properly sequence through all steps
3. Handle state for all wizard data

```typescript
const STEPS = [
  { id: "theme", component: ThemeStep },
  { id: "provider", component: ProviderStep },
  { id: "credentials", component: CredentialsStep },
  { id: "controls", component: ControlsStep },
  { id: "summary", component: SummaryStep },
];

interface OnboardingScreenProps {
  saveState: SaveConfigState;
  error: { message: string } | null;
  projectId: string;
  repoRoot: string;
  configuredProviders: ProviderStatus[];
  onSave: (data: OnboardingData) => void;
}

interface OnboardingData {
  theme: Theme;
  provider: AIProvider;
  apiKey: string;
  controlsMode: ControlsMode;
}
```

---

## Task 3.4: Update App.tsx for Trust Flow

**File:** `apps/cli/src/app/app.tsx`

Add trust-wizard view:
```typescript
if (view === "trust-wizard") {
  return (
    <ThemeProvider theme={theme}>
      <TrustWizardScreen
        repoRoot={repoRoot}
        projectId={projectId}
        onTrust={async (capabilities, mode) => {
          await handlers.trust.saveTrust({
            projectId,
            repoRoot,
            trustedAt: new Date().toISOString(),
            capabilities,
            trustMode: mode,
          });
          // Check if config exists
          if (state.config.checkState === "configured") {
            setView("main");
          } else {
            setView("onboarding");
          }
        }}
        onSkip={() => {
          // Exit or show warning
        }}
      />
    </ThemeProvider>
  );
}
```

---

## Task 3.5: Update useAppInit

**File:** `apps/cli/src/features/app/hooks/use-app-init.ts`

Check trust status on init:
```typescript
useEffect(() => {
  const init = async () => {
    // 1. Check trust status
    const trustResult = await loadTrust(projectId);

    // 2. Check config status
    await config.checkConfig();

    // 3. Determine initial screen
    if (!trustResult.ok || !trustResult.value) {
      setView("trust-wizard");
    } else if (config.checkState !== "configured") {
      setView("onboarding");
    } else {
      setView("main");
    }
  };

  init();
}, []);
```

---

## Task 3.6: Create Summary Step Component

**File:** `apps/cli/src/components/wizard/summary-step.tsx`

```typescript
interface SummaryStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  data: {
    theme: Theme;
    provider: AIProvider;
    hasApiKey: boolean;
    controlsMode: ControlsMode;
  };
  onFinish: () => void;
  onTestConnection?: () => Promise<boolean>;
  onBack?: () => void;
  isActive?: boolean;
}

export function SummaryStep({...}: SummaryStepProps) {
  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Summary"
      footer="Enter to finish, [t] Test connection, Esc back"
    >
      <Card title="Your Configuration">
        <Text>Theme: {data.theme}</Text>
        <Text>Provider: {data.provider}</Text>
        <Text>API Key: {data.hasApiKey ? "✓ Stored" : "Not set"}</Text>
        <Text>Controls: {data.controlsMode}</Text>
      </Card>

      <Box marginTop={1}>
        <Text dimColor>Config will be saved to: ~/.config/stargazer/</Text>
      </Box>
    </WizardFrame>
  );
}
```

---

## Validation

Test flow:
1. Delete trust file and config file
2. Start stargazer
3. Should show Trust Wizard first
4. After trust → should show Setup Wizard
5. After setup → should show Main Menu
6. Restart stargazer → should go directly to Main Menu
