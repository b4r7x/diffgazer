"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { ToastVariant } from "./toast-variants";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
  action?: ReactNode;
}

export interface ToastOptions {
  title: string;
  variant?: ToastVariant;
  message?: string;
  /** Auto-dismiss delay in ms. When `action` is set and duration is omitted, the toast persists indefinitely (WCAG 2.2.1 — enough time). */
  duration?: number;
  action?: ReactNode;
  id?: string;
}

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

interface StoreState {
  toasts: Toast[];
  dismissingIds: Set<string>;
}

const INITIAL_STATE: StoreState = { toasts: [], dismissingIds: new Set() };

interface TimerEntry {
  timeout: ReturnType<typeof setTimeout> | undefined;
  startedAt: number;
  remaining: number;
}

let state: StoreState = INITIAL_STATE;
const listeners = new Set<() => void>();
const timers = new Map<string, TimerEntry>();
let paused = false;

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

function scheduleAutoDismiss(id: string, variant: ToastVariant, duration?: number) {
  if ((variant === "error" || variant === "loading") && duration === undefined) return;
  const resolved = duration ?? DEFAULT_DURATION;
  if (!Number.isFinite(resolved) || resolved <= 0) return;
  const entry: TimerEntry = {
    timeout: paused ? undefined : setTimeout(() => dismiss(id), resolved),
    startedAt: Date.now(),
    remaining: resolved,
  };
  timers.set(id, entry);
}

function resolveNextToasts(current: Toast[], incoming: Toast): Toast[] {
  const existingIdx = current.findIndex((t) => t.id === incoming.id);
  if (existingIdx >= 0) return current.map((t) => (t.id === incoming.id ? incoming : t));

  const all = [...current, incoming];
  const evicted = all.slice(0, Math.max(0, all.length - MAX_TOASTS));
  for (const t of evicted) clearTimer(t.id);
  return all.slice(-MAX_TOASTS);
}

function create(options: ToastOptions): string {
  const id = options.id ?? crypto.randomUUID();
  const variant = options.variant ?? "info";
  const newToast: Toast = {
    id, variant,
    title: options.title,
    message: options.message,
    duration: options.duration,
    action: options.action,
  };

  clearTimer(id);
  const nextDismissing = new Set(state.dismissingIds);
  nextDismissing.delete(id);
  if (!options.action || options.duration !== undefined) {
    scheduleAutoDismiss(id, variant, options.duration);
  }

  const nextToasts = resolveNextToasts(state.toasts, newToast);
  const nextIds = new Set(nextToasts.map(t => t.id));
  for (const dismissId of nextDismissing) {
    if (!nextIds.has(dismissId)) nextDismissing.delete(dismissId);
  }

  state = { toasts: nextToasts, dismissingIds: nextDismissing };
  emit();
  return id;
}

export function dismiss(id?: string) {
  if (id) {
    state = {
      toasts: state.toasts,
      dismissingIds: new Set(state.dismissingIds).add(id),
    };
  } else {
    state = { toasts: state.toasts, dismissingIds: new Set(state.toasts.map(t => t.id)) };
  }
  emit();
}

export function remove(id: string) {
  clearTimer(id);
  const nextDismissing = new Set(state.dismissingIds);
  nextDismissing.delete(id);
  state = {
    toasts: state.toasts.filter((t) => t.id !== id),
    dismissingIds: nextDismissing,
  };
  emit();
}

export function pause() {
  if (paused) return;
  paused = true;
  for (const [, entry] of timers) {
    clearTimeout(entry.timeout);
    entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  }
}

export function resume() {
  if (!paused) return;
  paused = false;
  for (const [id, entry] of timers) {
    entry.startedAt = Date.now();
    entry.timeout = setTimeout(() => dismiss(id), entry.remaining);
  }
}

type VariantMethod = (title: string, options?: Omit<ToastOptions, "variant" | "title">) => string;

interface ToastFn extends Record<ToastVariant, VariantMethod> {
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

function variantMethod(variant: ToastVariant): VariantMethod {
  return (title, options) => create({ ...options, title, variant });
}

function promiseToast<T>(
  promise: Promise<T>,
  options: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: unknown) => string);
  },
): Promise<T> {
  const id = create({ title: options.loading, variant: "loading" });

  return promise.then(
    (data) => {
      const title = typeof options.success === "function" ? options.success(data) : options.success;
      create({ id, title, variant: "success" });
      return data;
    },
    (err) => {
      const title = typeof options.error === "function" ? options.error(err) : options.error;
      create({ id, title, variant: "error" });
      throw err;
    },
  );
}

export const toast: ToastFn = Object.assign(
  (title: string, options?: Omit<ToastOptions, "title">) => create({ ...options, title }),
  {
    success: variantMethod("success"),
    error: variantMethod("error"),
    warning: variantMethod("warning"),
    info: variantMethod("info"),
    loading: variantMethod("loading"),
    dismiss,
    promise: promiseToast,
  },
);

export function useToastStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

