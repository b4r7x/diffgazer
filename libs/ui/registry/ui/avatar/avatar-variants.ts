import { cva, type VariantProps } from "class-variance-authority";

/** Class variants for avatar, shared with the group context and the overflow indicator. */
export const avatarVariants = cva(
  "relative inline-flex items-center justify-center border border-foreground/40 font-mono font-medium text-foreground bg-background overflow-hidden shrink-0",
  {
    variants: {
      size: {
        sm: "size-6 text-2xs",
        md: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** Square size token shared by Avatar, AvatarGroup, and AvatarIndicator. */
export type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>;
