import { type UseScopeOptions, useScope } from "@diffgazer/keys";

// Names registered as dialog scopes. Registration is what marks a scope as a
// dialog — GlobalShortcuts suppresses on membership, not on a naming
// convention. Never pruned: being a dialog scope is a fact about the name, not
// about whether that dialog is open right now.
const dialogScopes = new Set<string>();

/**
 * Marks a keyboard scope name as a dialog scope and returns it. For dialogs
 * that cannot push through `useDialogScope` — an imperative `pushScope` or a
 * scope option on another keys hook — call this at module scope on the name
 * they push.
 */
export function dialogScope(name: string): string {
  dialogScopes.add(name);
  return name;
}

/** `useScope` for dialogs: pushing through this wrapper is what stands the global shortcuts down. */
export function useDialogScope(name: string, options?: UseScopeOptions): string | null {
  return useScope(dialogScope(name), options);
}

export function isDialogScope(scope: string | null): boolean {
  return scope !== null && dialogScopes.has(scope);
}
