"use client";

import { type AvatarProps, Avatar as AvatarRoot, type AvatarStatus, avatarVariants } from "./avatar";
import { AvatarFallback, type AvatarFallbackProps } from "./avatar-fallback";
import { AvatarGroup, type AvatarGroupProps, avatarGroupSpacingVariants } from "./avatar-group";
import { AvatarImage, type AvatarImageProps } from "./avatar-image";
import { AvatarIndicator, type AvatarIndicatorProps } from "./avatar-indicator";

const Avatar = Object.assign(AvatarRoot, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
  Group: AvatarGroup,
  Indicator: AvatarIndicator,
});

export { Avatar, avatarVariants, type AvatarProps, type AvatarStatus };
export { AvatarImage, type AvatarImageProps };
export { AvatarFallback, type AvatarFallbackProps };
export { AvatarGroup, avatarGroupSpacingVariants, type AvatarGroupProps };
export { AvatarIndicator, type AvatarIndicatorProps };
