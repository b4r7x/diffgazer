# Contract: @diffgazer/ui Public API

**Invariant**: The public API of @diffgazer/ui MUST NOT change. All existing exports must continue to work with identical type signatures. Consumer files must compile without modification.

## Preserved Exports

Every export listed below must remain available from `@diffgazer/ui` after the migration. The implementation source changes (local → diff-ui re-export), but the public API is frozen.

### Components (re-exported from diff-ui)

```
Button, ButtonProps, buttonVariants
Badge, BadgeProps, badgeVariants
Input, InputProps
Textarea, TextareaProps
inputVariants
Callout, CalloutProps, calloutVariants
Checkbox, CheckboxProps, CheckboxGroup, CheckboxGroupProps, CheckboxItem, CheckboxItemProps, CheckboxVariant
Radio, RadioProps, RadioGroup, RadioGroupProps, RadioGroupItem, RadioGroupItemProps
Panel, PanelHeader, PanelContent, PanelProps, PanelHeaderProps, PanelContentProps
Stepper, StepperStep, StepperSubstep, StepperProps, StepData, StepperStepProps, StepStatus, StepperSubstepProps, SubstepData, SubstepStatus
ScrollArea, ScrollAreaProps
BlockBar, BlockBarProps
SectionHeader, SectionHeaderProps
EmptyState, EmptyStateProps
Toast, ToastProvider, useToast, useToastData, useToastActions, ToastVariant, ToastPosition, ToastProviderProps
Tabs, TabsList, TabsTrigger, TabsContent, TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps
Dialog, DialogTrigger, DialogContent, DialogOverlay, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose + Props
NavigationList, NavigationListItem, NavigationListProps, NavigationListItemProps
Menu, MenuItem, MenuDivider, MenuProps, MenuItemProps, MenuDividerProps
SearchInput, SearchInputProps
ToggleGroup, ToggleGroupProps, ToggleGroupItem
CodeBlock, CodeBlockProps, CodeBlockLine
DiffView, DiffViewProps
KeyValue, KeyValueProps, KeyValueItemProps, KeyValueVariant, KeyValueLayout
HorizontalStepper, HorizontalStepperProps, HorizontalStepperStep
```

### Components (kept local)

```
Checklist, ChecklistProps, ChecklistItem
LabeledField, LabeledFieldProps, LabeledFieldColor
CardLayout, CardLayoutProps
```

### Utilities (re-exported from diff-ui)

```
cn (from diffui/lib/utils)
```

### Domain-specific (kept local, diffgazer-only)

Any severity badges, progress indicators, ASCII logo, and other diffgazer-specific exports remain as local implementations.

## CSS Contract

### Token Override Layer

The override stylesheet MUST define all diffgazer-specific color values for:
- Dark mode (`:root, [data-theme="dark"]`)
- Light mode (`[data-theme="light"]`)

It MUST preserve domain-specific tokens not in diff-ui:
- `--severity-blocker`, `--severity-high`, `--severity-medium`, `--severity-low`, `--severity-nit`
- `--status-running`, `--status-complete`, `--status-pending`

### Loading Order

diff-ui theme MUST load before diffgazer overrides to ensure cascade correctness.
