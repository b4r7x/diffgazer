# Web Settings UI Component Plan (Revised)

## Existing Components Analysis

### Available Containers

| Component | Style | Header | Use Case |
|-----------|-------|--------|----------|
| **Dialog** | 6px double border, backdrop, centered | DialogTitle in DialogHeader | Modals (Trust prompt, API key setup) |
| **Modal** | Similar to Dialog, simpler API | Built-in title prop | Simple prompts |
| **Panel** | Single border, vertical stack | Panel.Header (default/subtle) | Settings sections, two-column layouts |
| **SectionBox** | Single border, title in header bar | title prop (optional) | Simple titled containers |

### What's Missing

**Card with header-in-border** (dashboard_11 style) - Title text sits ON the border line, not inside a header bar:
```
┌─ TITLE TEXT ─────────────────┐
│  content                     │
└──────────────────────────────┘
```

vs SectionBox (header inside border):
```
┌──────────────────────────────┐
│ TITLE TEXT                   │
├──────────────────────────────┤
│  content                     │
└──────────────────────────────┘
```

---

## Revised Component Strategy

### For Trust Prompt (Screen 2 - Onboarding)

**Use: Dialog + Panel**

```tsx
<Dialog open={showTrust} onOpenChange={setShowTrust}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Trust this directory?</DialogTitle>
    </DialogHeader>
    <DialogBody>
      <TrustPermissionsContent
        directory={path}
        value={caps}
        onChange={setCaps}
      />
    </DialogBody>
    <DialogFooter>
      <DialogClose>Cancel</DialogClose>
      <Button onClick={handleTrust}>Trust</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### For Trust Settings (Screen 9 - Settings Page)

**Use: Panel or SectionBox**

```tsx
<Panel>
  <Panel.Header>TRUST & PERMISSIONS</Panel.Header>
  <Panel.Content>
    <TrustPermissionsContent
      directory={path}
      value={caps}
      onChange={setCaps}
      showActions={true}
    />
  </Panel.Content>
</Panel>
```

### Shared Content Component

**TrustPermissionsContent** - Pure content (no container):
- Directory path display
- Permission checkboxes (readFiles, readGit, runCommands)
- Security warning Alert
- Optional action buttons (Save/Revoke)

---

## Required New Components (Reduced)

### HIGH Priority

| Component | Reason | Existing Alternative |
|-----------|--------|---------------------|
| **Tabs** | Not covered by any existing | None |
| **RadioGroup** | `( ) / (x)` style not in Checkbox | None (Checkbox is `[ ] / [x]`) |
| **Alert** | Warning/info boxes with icon | None |

### MEDIUM Priority

| Component | Reason | Existing Alternative |
|-----------|--------|---------------------|
| **Card** | Header-in-border style (dashboard_11) | SectionBox (close but different) |
| **WizardProgress** | Step dots for onboarding | None |
| **SettingsNav** | Nav list with current values | NavigationList (can extend) |

### LOW Priority (Maybe Skip)

| Component | Reason | Existing Alternative |
|-----------|--------|---------------------|
| InfoBox | Help text box | Can use styled div |
| PreviewBox | Settings preview | Can use SectionBox |
| KeyInput | API key modes | Can compose RadioGroup + Input |

---

## Revised Implementation Plan

### Phase 1: Core UI Components (3 parallel agents)

| Component | Agent | Notes |
|-----------|-------|-------|
| **Tabs** | `react-component-architect` | Compound pattern like Dialog |
| **RadioGroup** | `react-component-architect` | Compound pattern, `( ) / (x)` style |
| **Alert** | `tailwind-frontend-expert` | CVA variants (info, warning, error, success) |

### Phase 2: Settings Content Components (3 parallel agents)

| Component | Agent | Notes |
|-----------|-------|-------|
| **TrustPermissionsContent** | `react-component-architect` | Uses CheckboxGroup + Alert |
| **ProviderSelectorContent** | `react-component-architect` | Uses RadioGroup + Input |
| **ThemeSelectorContent** | `tailwind-frontend-expert` | Uses RadioGroup |

### Phase 3: Page Assembly (2 parallel agents)

| Task | Agent | Notes |
|------|-------|-------|
| **Settings Page** | `react-component-architect` | Wire up with Dialog/Panel containers |
| **Onboarding Flow** | `react-component-architect` | WizardProgress + step management |

### Phase 4: Optional Polish

| Component | Agent | Notes |
|-----------|-------|-------|
| **Card** | `tailwind-frontend-expert` | Only if SectionBox doesn't work |
| **SettingsNav** | `react-component-architect` | Only if NavigationList needs extension |

---

## File Structure

```
apps/web/src/components/
├── ui/
│   ├── tabs.tsx           # NEW - Phase 1
│   ├── radio-group.tsx    # NEW - Phase 1
│   ├── alert.tsx          # NEW - Phase 1
│   ├── wizard-progress.tsx # NEW - Phase 3
│   ├── dialog.tsx         # EXISTS - use for modals
│   ├── panel.tsx          # EXISTS - use for sections
│   ├── section-box.tsx    # EXISTS - use for titled boxes
│   └── ...
├── settings/
│   ├── trust-permissions-content.tsx  # NEW - Phase 2
│   ├── provider-selector-content.tsx  # NEW - Phase 2
│   ├── theme-selector-content.tsx     # NEW - Phase 2
│   ├── controls-selector-content.tsx  # NEW - Phase 3
│   ├── diagnostics-content.tsx        # NEW - Phase 4
│   └── index.ts
├── onboarding/
│   ├── trust-dialog.tsx       # NEW - Phase 3 (Dialog + TrustPermissionsContent)
│   ├── provider-dialog.tsx    # NEW - Phase 3 (Dialog + ProviderSelectorContent)
│   ├── onboarding-wizard.tsx  # NEW - Phase 3
│   └── index.ts
```

---

## Summary

**Reuse existing:**
- Dialog (for modals)
- Panel (for settings sections)
- SectionBox (for titled containers)
- CheckboxGroup, Input, Button, NavigationList, Modal

**Build new:**
- Tabs (not covered)
- RadioGroup (different from Checkbox)
- Alert (not covered)
- Content components (TrustPermissions, Provider, Theme, Controls)
- Onboarding wizard flow

**Total new components: 7-9** (down from 15)
