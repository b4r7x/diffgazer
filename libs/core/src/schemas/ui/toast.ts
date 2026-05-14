import { z } from "zod";

/** @see libs/ui/registry/ui/toast/toast-variants.ts ToastVariant (superset with "loading", used for component-library styling) */
const TOAST_VARIANTS = ["success", "error", "warning", "info"] as const;
const ToastVariantSchema = z.enum(TOAST_VARIANTS);
export type ToastVariant = z.infer<typeof ToastVariantSchema>;
