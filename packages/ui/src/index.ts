// @diffgazer/ui - TUI-themed component library
export { cn } from "./lib/cn";

// Primitives
export { Button, type ButtonProps, buttonVariants } from "./components/button";
export { Badge, type BadgeProps, badgeVariants } from "./components/badge";
export { Input, type InputProps, Textarea, type TextareaProps, inputVariants } from "./components/input";
export { Callout, type CalloutProps, calloutVariants } from "./components/callout";
export { Checkbox, type CheckboxProps, CheckboxGroup, type CheckboxGroupProps, CheckboxItem, type CheckboxItemProps, type CheckboxVariant } from "./components/checkbox";
export { Radio, type RadioProps, RadioGroup, type RadioGroupProps, RadioGroupItem, type RadioGroupItemProps } from "./components/radio-group";

// Display & Layout
export { Panel, PanelHeader, PanelContent, type PanelProps, type PanelHeaderProps, type PanelContentProps } from "./components/panel";
export { Stepper, StepperStep, StepperSubstep, type StepperProps, type StepData, type StepperStepProps, type StepStatus, type StepperSubstepProps, type SubstepData, type SubstepStatus } from "./components/stepper";
export { ScrollArea, type ScrollAreaProps } from "./components/scroll-area";
export { FocusablePane, type FocusablePaneProps } from "./components/focusable-pane";
export { CardLayout, type CardLayoutProps } from "./components/card-layout";
export { BlockBar, type BlockBarProps } from "./components/block-bar";
export { SectionHeader, type SectionHeaderProps } from "./components/section-header";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export { KeyValueRow, type KeyValueRowProps } from "./components/key-value-row";

// Compound: Toast
export {
  ToastProvider,
  useToast,
  useToastData,
  useToastActions,
  type Toast,
  type ToastVariant,
  type ToastPosition,
  type ToastProviderProps,
} from "./components/toast";

// Compound: Tabs
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
} from "./components/tabs";

// Compound: Dialog
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  type DialogProps,
  type DialogTriggerProps,
  type DialogContentProps,
  type DialogHeaderProps,
  type DialogTitleProps,
  type DialogDescriptionProps,
  type DialogBodyProps,
  type DialogFooterProps,
  type DialogCloseProps,
} from "./components/dialog";

// Compound: NavigationList
export {
  NavigationList,
  NavigationListItem,
  type NavigationListProps,
  type NavigationListItemProps,
} from "./components/navigation-list";

// Compound: Menu
export {
  Menu,
  MenuItem,
  MenuDivider,
  type MenuProps,
  type MenuItemProps,
  type MenuDividerProps,
} from "./components/menu";

// Feature Components
export { SearchInput, type SearchInputProps } from "./components/search-input";
export { ToggleGroup, type ToggleGroupProps, type ToggleGroupItem } from "./components/toggle-group";
export { CodeBlock, type CodeBlockProps, type CodeBlockLine } from "./components/code-block";
export { DiffView, type DiffViewProps } from "./components/diff-view";
export { KeyValue, type KeyValueProps } from "./components/key-value";
export { LabeledField, type LabeledFieldProps, type LabeledFieldColor } from "./components/labeled-field";
export { Checklist, type ChecklistProps, type ChecklistItem } from "./components/checklist";
export { HorizontalStepper, type HorizontalStepperProps, type HorizontalStepperStep } from "./components/horizontal-stepper";
