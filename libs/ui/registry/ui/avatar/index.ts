"use client";

import { Avatar as AvatarRoot, avatarVariants, type AvatarProps, type AvatarStatus } from "./avatar";
import { AvatarImage, type AvatarImageProps } from "./avatar-image";
import { AvatarFallback, type AvatarFallbackProps } from "./avatar-fallback";
import { AvatarGroup, avatarGroupSpacingVariants, type AvatarGroupProps } from "./avatar-group";
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
