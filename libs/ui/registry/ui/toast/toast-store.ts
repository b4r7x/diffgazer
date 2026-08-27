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

// The region's persistent/timed contract. A persistent toast never
// auto-dismisses: it carries a rendered action or an error/loading tone with no
// explicit duration, or a duration that never elapses. Persistent toasts are
// not evicted before transient ones (WCAG 2.2.1 — enough time) and are the ones
// the arrow-key entry (`focusToastRegion`) is wired for; timed toasts stay
// hotkey/pointer-only, since focus on a timer-unmounted element would strand
// the user. HUD drops actions and always auto-dismisses, so a HUD toast is
// transient even with an error/loading tone.
export function isPersistentToast(t: Toast): boolean {
  if (t.duration !== undefined) return !(Number.isFinite(t.duration) && t.duration > 0);
  if (t.action) return true;
  return (t.tone === "error" || t.tone === "loading") && t.variant !== "hud";
}

function resolveNextToasts(current: Toast[], incoming: Toast): Toast[] {
  const existingIdx = current.findIndex((t) => t.id === incoming.id);
  if (existingIdx >= 0) return current.map((t) => (t.id === incoming.id ? incoming : t));

  if (current.length < MAX_TOASTS) return [...current, incoming];

  const evicted: Toast[] = [];
  const remaining = [...current];

  while (remaining.length >= MAX_TOASTS) {
    const transientIndex = remaining.findIndex((t) => !isPersistentToast(t));
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
  if (!isPersistentToast(newToast)) {
    timers().schedule(id, newToast.duration ?? DEFAULT_DURATION, state.paused);
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

export function useToastStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useHasPersistentToast(): boolean {
  const { toasts, dismissingIds } = useToastStore();
  return toasts.some((t) => !dismissingIds.has(t.id) && isPersistentToast(t));
}
