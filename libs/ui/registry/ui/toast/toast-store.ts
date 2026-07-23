"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createToastTimers, type ToastTimerSnapshot, type ToastTimers } from "./toast-timers";
import type { ToastTone, ToastVariant } from "./toast-variants";

export type { ToastTimerSnapshot } from "./toast-timers";
export type { ToastPosition } from "./toast-variants";

export interface Toast {
  /** ID applied to the rendered element. */
  id: string;
  /** Visual tone. */
  tone: ToastTone;
  /** Visual style variant. */
  variant: ToastVariant;
  /** Title content. */
  title: string;
  /** Message content. */
  message?: string;
  /** Duration in milliseconds. */
  duration?: number;
  /** Action rendered with the item. */
  action?: ReactNode;
  /** Accessible name for the dismiss button. Defaults to `Dismiss: ${title}`. */
  dismissLabel?: string;
  /** Screen-reader tone word announced before the title. Defaults to the tone name. */
  toneLabel?: string;
}

/** Options for toast. */
export interface ToastOptions {
  /** Title content. */
  title: string;
  /** Visual tone. */
  tone?: ToastTone;
  /** Visual style variant. */
  variant?: ToastVariant;
  /** Message content. */
  message?: string;
  /** Duration in milliseconds. */
  duration?: number;
  /** Action rendered with the item. */
  action?: ReactNode;
  /** ID applied to the rendered element. */
  id?: string;
  /** Accessible label for dismiss. */
  dismissLabel?: string;
  /** Accessible label for tone. */
  toneLabel?: string;
}

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

export type ToastPauseCause = "hover" | "focus" | "document-hidden";

interface StoreState {
  toasts: Toast[];
  dismissingIds: Set<string>;
  pauseCauses: Set<ToastPauseCause>;
  paused: boolean;
  timerVersion: number;
}

const INITIAL_STATE: StoreState = {
  toasts: [],
  dismissingIds: new Set(),
  pauseCauses: new Set(),
  paused: false,
  timerVersion: 0,
};

let state: StoreState = INITIAL_STATE;
const listeners = new Set<() => void>();
let toastTimers: ToastTimers | undefined;
let fallbackToastId = 0;

function timers() {
  if (!toastTimers) {
    toastTimers = createToastTimers({ onElapsed: (id) => dismiss(id) });
  }
  return toastTimers;
}

function emit() {
  for (const listener of listeners) listener();
}

function clearTimer(id: string) {
  timers().clear(id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreState {
  return state;
}

function getServerSnapshot(): StoreState {
  return INITIAL_STATE;
}

function scheduleAutoDismiss(id: string, tone: ToastTone, duration?: number) {
  if ((tone === "error" || tone === "loading") && duration === undefined) return;
  const resolved = duration ?? DEFAULT_DURATION;
  if (!Number.isFinite(resolved) || resolved <= 0) return;
  timers().schedule(id, resolved, state.paused);
}

function isEvictable(t: Toast): boolean {
  // Persistent toasts (with actions and no explicit duration) and
  // error/loading toasts without duration should not be evicted before
  // transient toasts (WCAG 2.2.1 — enough time).
  if (t.action && t.duration === undefined) return false;
  if ((t.tone === "error" || t.tone === "loading") && t.duration === undefined) return false;
  return true;
}

function resolveNextToasts(current: Toast[], incoming: Toast): Toast[] {
  const existingIdx = current.findIndex((t) => t.id === incoming.id);
  if (existingIdx >= 0) return current.map((t) => (t.id === incoming.id ? incoming : t));

  if (current.length < MAX_TOASTS) return [...current, incoming];

  const evicted: Toast[] = [];
  const remaining = [...current];

  while (remaining.length >= MAX_TOASTS) {
    const transientIndex = remaining.findIndex(isEvictable);
    const evictionIndex = transientIndex >= 0 ? transientIndex : 0;
    const [removed] = remaining.splice(evictionIndex, 1);
    if (removed) evicted.push(removed);
  }

  for (const t of evicted) clearTimer(t.id);
  return [...remaining, incoming];
}

function createToastId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);

  fallbackToastId += 1;
  return `toast-${Date.now().toString(36)}-${fallbackToastId.toString(36)}`;
}

function create(options: ToastOptions): string {
  const id = options.id ?? createToastId();
  const tone = options.tone ?? "info";
  const variant = options.variant ?? "card";

  const effectiveAction = variant === "hud" ? undefined : options.action;
  const newToast: Toast = {
    id,
    tone,
    variant,
    title: options.title,
    message: options.message,
    duration: options.duration,
    action: effectiveAction,
    dismissLabel: options.dismissLabel,
    toneLabel: options.toneLabel,
  };

  clearTimer(id);
  const nextDismissing = new Set(state.dismissingIds);
  nextDismissing.delete(id);
  // Persist indefinitely only when there's a real, rendered action (WCAG 2.2.1).
  // HUD drops the action, so a HUD with an "action" still auto-dismisses.
  if (!effectiveAction || options.duration !== undefined) {
    scheduleAutoDismiss(id, tone, options.duration);
  }

  const nextToasts = resolveNextToasts(state.toasts, newToast);
  const nextIds = new Set(nextToasts.map((t) => t.id));
  for (const dismissId of nextDismissing) {
    if (!nextIds.has(dismissId)) nextDismissing.delete(dismissId);
  }

  state = {
    ...state,
    toasts: nextToasts,
    dismissingIds: nextDismissing,
    timerVersion: timers().version,
  };
  emit();
  return id;
}

export function dismiss(id?: string) {
  if (id) {
    state = {
      ...state,
      dismissingIds: new Set(state.dismissingIds).add(id),
    };
  } else {
    state = { ...state, dismissingIds: new Set(state.toasts.map((t) => t.id)) };
  }
  emit();
}

export function remove(id: string) {
  clearTimer(id);
  const nextDismissing = new Set(state.dismissingIds);
  nextDismissing.delete(id);
  const nextToasts = state.toasts.filter((t) => t.id !== id);
  let pauseCauses = state.pauseCauses;
  let paused = state.paused;
  if (nextToasts.length === 0) {
    if (toastTimers) toastTimers.resume();
    toastTimers = undefined;
    pauseCauses = new Set();
    paused = false;
  }
  state = {
    ...state,
    toasts: nextToasts,
    dismissingIds: nextDismissing,
    pauseCauses,
    paused,
    timerVersion: nextToasts.length === 0 ? 0 : timers().version,
  };
  emit();
}

export function pause(cause: ToastPauseCause) {
  if (state.pauseCauses.has(cause)) return;
  const pauseCauses = new Set(state.pauseCauses).add(cause);
  if (state.paused) {
    state = { ...state, pauseCauses, paused: true };
    emit();
    return;
  }
  timers().pause();
  state = {
    ...state,
    pauseCauses,
    paused: true,
    timerVersion: timers().version,
  };
  emit();
}

export function resume(cause: ToastPauseCause) {
  if (!state.pauseCauses.has(cause)) return;
  const pauseCauses = new Set(state.pauseCauses);
  pauseCauses.delete(cause);
  if (pauseCauses.size > 0) {
    state = { ...state, pauseCauses, paused: true };
    emit();
    return;
  }
  timers().resume();
  state = {
    ...state,
    pauseCauses,
    paused: false,
    timerVersion: timers().version,
  };
  emit();
}

export function getTimerSnapshot(id: string): ToastTimerSnapshot | null {
  return timers().snapshot(id);
}

type ToneMethod = (title: string, options?: Omit<ToastOptions, "tone" | "title">) => string;

interface ToastFn extends Record<ToastTone, ToneMethod> {
  (title: string, options?: Omit<ToastOptions, "title">): string;
  dismiss: (id?: string) => void;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) => Promise<T>;
}

function toneMethod(tone: ToastTone): ToneMethod {
  return (title, options) => create({ ...options, title, tone });
}

function promiseToast<T>(
  promise: Promise<T>,
  options: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: unknown) => string);
  },
): Promise<T> {
  const id = create({ title: options.loading, tone: "loading" });

  return promise.then(
    (data) => {
      const title = typeof options.success === "function" ? options.success(data) : options.success;
      create({ id, title, tone: "success" });
      return data;
    },
    (err) => {
      const title = typeof options.error === "function" ? options.error(err) : options.error;
      create({ id, title, tone: "error" });
      throw err;
    },
  );
}

export const toast: ToastFn = Object.assign(
  (title: string, options?: Omit<ToastOptions, "title">) => create({ ...options, title }),
  {
    success: toneMethod("success"),
    error: toneMethod("error"),
    warning: toneMethod("warning"),
    info: toneMethod("info"),
    loading: toneMethod("loading"),
    dismiss,
    promise: promiseToast,
  },
);

/** Provides toast store behavior. */
export function useToastStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
