import { Avatar as AvatarRoot, type AvatarProps, type AvatarStatus } from "./avatar";
import { AvatarImage, type AvatarImageProps } from "./avatar-image";
import { AvatarFallback, type AvatarFallbackProps } from "./avatar-fallback";
import { AvatarGroup, type AvatarGroupProps } from "./avatar-group";
import { AvatarIndicator, type AvatarIndicatorProps } from "./avatar-indicator";

const Avatar = Object.assign(AvatarRoot, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
  Group: AvatarGroup,
  Indicator: AvatarIndicator,
});

export { Avatar, type AvatarProps, type AvatarStatus };
export { AvatarImage, type AvatarImageProps };
export { AvatarFallback, type AvatarFallbackProps };
export { AvatarGroup, type AvatarGroupProps };
export { AvatarIndicator, type AvatarIndicatorProps };
