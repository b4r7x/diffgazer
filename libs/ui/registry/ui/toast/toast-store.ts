"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import type { ToastTone, ToastVariant } from "./toast-variants";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Toast {
  id: string;
  tone: ToastTone;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
  action?: ReactNode;
}

export interface ToastOptions {
  title: string;
  tone?: ToastTone;
  variant?: ToastVariant;
  message?: string;
  duration?: number;
  action?: ReactNode;
  id?: string;
}

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

interface StoreState {
  toasts: Toast[];
  dismissingIds: Set<string>;
  paused: boolean;
}

const INITIAL_STATE: StoreState = { toasts: [], dismissingIds: new Set(), paused: false };

interface TimerEntry {
  timeout: ReturnType<typeof setTimeout> | undefined;
  startedAt: number;
  remaining: number;
  duration: number;
}

let state: StoreState = INITIAL_STATE;
const listeners = new Set<() => void>();
const timers = new Map<string, TimerEntry>();
let fallbackToastId = 0;

function emit() {
  for (const listener of listeners) listener();
}

function clearTimer(id: string) {
  const entry = timers.get(id);
  if (entry) {
    clearTimeout(entry.timeout);
    timers.delete(id);
  }
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
  const entry: TimerEntry = {
    timeout: state.paused ? undefined : setTimeout(() => dismiss(id), resolved),
    startedAt: Date.now(),
    remaining: resolved,
    duration: resolved,
  };
  timers.set(id, entry);
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

  const all = [...current, incoming];
  if (all.length <= MAX_TOASTS) return all;

  // Evict transient toasts first (oldest first), then persistent ones
  // only if no transient candidates remain.
  const evictCount = all.length - MAX_TOASTS;
  const evicted: Toast[] = [];
  const remaining = [...all];

  // First pass: evict oldest transient toasts
  for (let i = 0; i < remaining.length && evicted.length < evictCount; i++) {
    const toast = remaining[i];
    if (toast && isEvictable(toast)) {
      const [removed] = remaining.splice(i, 1);
      if (removed) evicted.push(removed);
      i--; // adjust index after splice
    }
  }

  // Second pass: if still over limit, evict oldest persistent toasts
  while (remaining.length > MAX_TOASTS) {
    const removed = remaining.shift();
    if (removed) evicted.push(removed);
  }

  for (const t of evicted) clearTimer(t.id);
  return remaining;
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

  state = { ...state, toasts: nextToasts, dismissingIds: nextDismissing };
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
  state = {
    ...state,
    toasts: state.toasts.filter((t) => t.id !== id),
    dismissingIds: nextDismissing,
  };
  emit();
}

export function pause() {
  if (state.paused) return;
  for (const [, entry] of timers) {
    clearTimeout(entry.timeout);
    entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  }
  state = { ...state, paused: true };
  emit();
}

export function resume() {
  if (!state.paused) return;
  for (const [id, entry] of timers) {
    entry.startedAt = Date.now();
    entry.timeout = setTimeout(() => dismiss(id), entry.remaining);
  }
  state = { ...state, paused: false };
  emit();
}

export interface ToastTimerSnapshot {
  duration: number;
  remaining: number;
  startedAt: number;
  paused: boolean;
}

export function getTimerSnapshot(id: string): ToastTimerSnapshot | null {
  const entry = timers.get(id);
  if (!entry) return null;
  return {
    duration: entry.duration,
    remaining: entry.remaining,
    startedAt: entry.startedAt,
    paused: state.paused,
  };
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
