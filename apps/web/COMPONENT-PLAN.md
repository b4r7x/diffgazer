# Web Settings UI Component Plan

## Goal
Create reusable settings UI that works for both:
1. Settings page (full settings experience)
2. Onboarding flow (wizard-style progression through settings)

---

## Screen Coverage (from UI Mocks)

### Settings Screens
| Screen | Name | Key Elements |
|--------|------|--------------|
| 5 | AI Provider Selection | Radio buttons, API key input, progress dots |
| 8 | Settings Hub Overview | Navigation list with values, status badges |
| 9 | Trust & Permissions | Checkboxes, warning alert, action buttons |
| 10 | API Key Setup | Radio options, masked input, env var option |
| 11 | Control Settings | Mode radio, preview box, behavior toggles |
| 12 | System Diagnostics | Info fields grid, version badges, action buttons |

### Onboarding Screens
| Screen | Name | Key Elements |
|--------|------|--------------|
| 2 | Trust Directory Modal | Permission checkboxes, directory path, confirm |
| 5 | Provider Selection | Same as settings, but in wizard context |
| 13 | Welcome Splash | Feature list, quick start commands, CTA buttons |

### Review Screens (context for consistency)
| Screen | Name | Key Elements |
|--------|------|--------------|
| 1 | Issue Review Dashboard | Tabs, sidebar list, code panel |
| 16 | Progress Monitoring | Progress steps, activity log, metrics |
| 17 | Evidence Panel | Code viewer with tabs |
| 18 | Analysis Summary | Charts, issue breakdown, top issues |

---

## Required New Components

### 1. Card (Priority: HIGH)
**Purpose:** Container with header embedded in border (Screen 9, 10, 11 style)

```tsx
<Card title="TRUST & PERMISSIONS" badge={<StatusBadge status="active" label="TRUSTED" />}>
  <Card.Section title="Optional subsection">
    content
  </Card.Section>
</Card>
```

**Visual:**
```
┌─ TRUST & PERMISSIONS ─────── [TRUSTED] ┐
│                                        │
│  [ ] Read repository files             │
│  [ ] Read git metadata                 │
│  [ ] Run commands                      │
│                                        │
└────────────────────────────────────────┘
```

**Props:**
- `title: string` - Header text in border
- `badge?: ReactNode` - Optional status badge
- `children: ReactNode`
- `className?: string`

---

### 2. Tabs (Priority: HIGH)
**Purpose:** Horizontal tab navigation (Screen 7 style: `[Review Runs] [Sessions]`)

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <Tabs.List>
    <Tabs.Trigger value="runs">Review Runs</Tabs.Trigger>
    <Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="runs">...</Tabs.Content>
  <Tabs.Content value="sessions">...</Tabs.Content>
</Tabs>
```

---

### 3. RadioGroup (Priority: HIGH)
**Purpose:** Single-select with `( ) / (x)` style (Screen 5, 11)

```tsx
<RadioGroup value={provider} onValueChange={setProvider}>
  <RadioGroup.Item value="openai" label="OpenAI" />
  <RadioGroup.Item value="gemini" label="Gemini" />
  <RadioGroup.Item value="anthropic" label="Anthropic" />
  <RadioGroup.Item value="ollama" label="Local (Ollama)" />
</RadioGroup>
```

**Visual (Screen 5):**
```
( ) OpenAI
(x) Gemini          <- blue highlight
( ) Anthropic
( ) Local (Ollama)
```

---

### 4. SettingsNav (Priority: HIGH)
**Purpose:** Settings hub navigation with current values (Screen 8)

```tsx
<SettingsNav value={section} onValueChange={setSection}>
  <SettingsNav.Item value="trust" label="Trust & Permissions" indicator="✓" />
  <SettingsNav.Item value="theme" label="Theme" value="DARK" />
  <SettingsNav.Item value="provider" label="Provider & Model" value="Gemini" />
  <SettingsNav.Item value="credentials" label="Credentials" value="2 Active" />
</SettingsNav>
```

**Visual (Screen 8):**
```
  Trust & Permissions     ✓
▶ Theme                   DARK      <- highlighted
  Provider & Model        Gemini
  Credentials             2 Active
  Controls                Default
  Diagnostics/About       v2.1.0
```

---

### 5. Alert (Priority: HIGH)
**Purpose:** Warning/info boxes with icon (Screen 9)

```tsx
<Alert variant="warning" title="SECURITY WARNING">
  Run commands capability allows execution of arbitrary shell commands...
</Alert>
```

**Variants:** `info`, `warning`, `error`, `success`

**Visual (Screen 9):**
```
┌─ ! ──────────────────────────────────┐
│ SECURITY WARNING                     │
│ Run commands capability allows...    │
└──────────────────────────────────────┘
```

---

### 6. WizardProgress (Priority: HIGH)
**Purpose:** Step indicator for onboarding (Screen 5)

```tsx
<WizardProgress current={2} total={4} />
```

**Visual:** `● ● ○ ○` (filled dots for completed/current)

---

### 7. InfoBox (Priority: MEDIUM)
**Purpose:** Help/hint text in bordered box (Screen 11)

```tsx
<InfoBox>
  info: Changes are previewed instantly. Press Enter to persist.
</InfoBox>
```

---

### 8. KeyInput (Priority: MEDIUM)
**Purpose:** Masked API key input with options (Screen 10)

```tsx
<KeyInput
  mode={mode}
  onModeChange={setMode}
  value={key}
  onChange={setKey}
  envVar="GOOGLE_API_KEY"
/>
```

**Visual (Screen 10):**
```
[●] Paste Key Now
    KEY: ****************************|

[ ] Import from Env
    $ GOOGLE_API_KEY

[ ] Read from Stdin
```

---

### 9. PreviewBox (Priority: MEDIUM)
**Purpose:** Live preview of settings (Screen 11)

```tsx
<PreviewBox title="PREVIEW">
  ↑/↓: Navigate  Enter: Open  q: Quit
</PreviewBox>
```

---

### 10. DiagnosticsGrid (Priority: LOW)
**Purpose:** System info display (Screen 12)

```tsx
<DiagnosticsGrid>
  <DiagnosticsGrid.Section title="VERSION INFO">
    <DiagnosticsGrid.Field label="Stargazer" value="v1.4.2" />
    <DiagnosticsGrid.Field label="Node" value="v20.5.1" />
  </DiagnosticsGrid.Section>
</DiagnosticsGrid>
```

---

## Existing Components to Reuse

| Component | Screen Usage | Ready |
|-----------|--------------|-------|
| Button | All screens (Save, Revoke, Export) | ✅ |
| Checkbox/CheckboxGroup | Screen 2, 9, 11 | ✅ |
| Input | Screen 5, 10 | ✅ |
| NavigationList | Screen 8 (can extend for SettingsNav) | ✅ |
| Modal | Screen 2, 10, 12 | ✅ |
| StatusBadge | Screen 8, 9, 10 | ✅ |
| Panel | Two-column layouts | ✅ |
| Table | Screen 4, 7 | ✅ |

---

## Shared Settings Sections (Reusable for Settings + Onboarding)

### 1. TrustPermissions (Screen 2, 9)
```tsx
<TrustPermissions
  directory="~/dev/stargazer"
  value={caps}
  onChange={setCaps}
  showWarning={true}
/>
```
- Uses: Card, CheckboxGroup, Alert
- Permissions: readFiles, readGit, runCommands

### 2. ProviderSelector (Screen 5, 8)
```tsx
<ProviderSelector
  value={provider}
  onChange={setProvider}
  apiKey={key}
  onApiKeyChange={setKey}
/>
```
- Uses: RadioGroup, KeyInput

### 3. ThemeSelector (Screen 8)
```tsx
<ThemeSelector value={theme} onChange={setTheme} />
```
- Uses: RadioGroup (auto, dark, light, terminal)

### 4. ControlsSelector (Screen 11)
```tsx
<ControlsSelector
  mode={mode}
  onModeChange={setMode}
  behaviors={behaviors}
  onBehaviorsChange={setBehaviors}
/>
```
- Uses: RadioGroup, CheckboxGroup, PreviewBox

### 5. DiagnosticsPanel (Screen 12)
```tsx
<DiagnosticsPanel />
```
- Uses: DiagnosticsGrid, Button

---

## Page Structures

### Settings Page (Screen 8 as hub)
```tsx
<SettingsPage>
  {/* Two-column layout */}
  <Panel>
    <Panel.Sidebar>
      <SettingsNav value={section} onValueChange={setSection}>
        <SettingsNav.Item value="trust" label="Trust & Permissions" />
        <SettingsNav.Item value="theme" label="Theme" />
        <SettingsNav.Item value="provider" label="Provider & Model" />
        <SettingsNav.Item value="credentials" label="Credentials" />
        <SettingsNav.Item value="controls" label="Controls" />
        <SettingsNav.Item value="diagnostics" label="Diagnostics" />
      </SettingsNav>
    </Panel.Sidebar>

    <Panel.Content>
      {section === 'trust' && <TrustPermissions />}
      {section === 'theme' && <ThemeSelector />}
      {section === 'provider' && <ProviderSelector />}
      {section === 'credentials' && <CredentialsManager />}
      {section === 'controls' && <ControlsSelector />}
      {section === 'diagnostics' && <DiagnosticsPanel />}
    </Panel.Content>
  </Panel>
</SettingsPage>
```

### Onboarding Wizard (Screen 2, 5, 13)
```tsx
<OnboardingWizard>
  <WizardProgress current={step} total={4} />

  {step === 1 && <WelcomeStep onContinue={() => setStep(2)} />}
  {step === 2 && <TrustPermissions onContinue={() => setStep(3)} />}
  {step === 3 && <ProviderSelector onContinue={() => setStep(4)} />}
  {step === 4 && <CompletionStep />}
</OnboardingWizard>
```

---

## Implementation Order

### Phase 1: Foundation (HIGH priority)
1. **Card** - Base container for all settings sections
2. **Tabs** - Tab navigation
3. **RadioGroup** - Single-select options
4. **Alert** - Warning/info boxes

### Phase 2: Settings Sections (HIGH priority)
5. **TrustPermissions** - Trust config section
6. **ProviderSelector** - Provider + API key section
7. **SettingsNav** - Settings hub navigation
8. **ThemeSelector** - Theme section

### Phase 3: Additional Components (MEDIUM priority)
9. **WizardProgress** - Onboarding steps
10. **ControlsSelector** - Controls section
11. **KeyInput** - API key input modes
12. **PreviewBox** - Settings preview

### Phase 4: Polish (LOW priority)
13. **DiagnosticsPanel** - System info
14. **InfoBox** - Help text
15. **DiagnosticsGrid** - Info display

---

## File Structure

```
apps/web/src/components/
├── ui/
│   ├── card.tsx           # NEW - Phase 1
│   ├── tabs.tsx           # NEW - Phase 1
│   ├── radio-group.tsx    # NEW - Phase 1
│   ├── alert.tsx          # NEW - Phase 1
│   ├── wizard-progress.tsx # NEW - Phase 3
│   ├── info-box.tsx       # NEW - Phase 4
│   ├── preview-box.tsx    # NEW - Phase 3
│   └── ... (existing)
├── settings/
│   ├── settings-nav.tsx           # NEW - Phase 2
│   ├── trust-permissions.tsx      # NEW - Phase 2
│   ├── provider-selector.tsx      # NEW - Phase 2
│   ├── theme-selector.tsx         # NEW - Phase 2
│   ├── controls-selector.tsx      # NEW - Phase 3
│   ├── key-input.tsx              # NEW - Phase 3
│   ├── diagnostics-panel.tsx      # NEW - Phase 4
│   └── index.ts
├── onboarding/
│   ├── onboarding-wizard.tsx      # NEW - Phase 3
│   ├── welcome-step.tsx           # NEW - Phase 3
│   ├── completion-step.tsx        # NEW - Phase 3
│   └── index.ts
```

---

## Design Tokens Reference

```css
/* Colors from mocks */
--tui-bg: #0a0a0a to #1a1a1a
--tui-border: #333 to #555
--tui-text: white
--tui-text-muted: #888
--tui-primary: #3b82f6 (blue)
--tui-success: #22c55e (green)
--tui-warning: #f59e0b (orange)
--tui-error: #ef4444 (red)

/* Typography */
font-family: monospace
font-size: 14px base

/* Spacing */
padding: 16-24px in cards
gap: 8-12px between elements
```
