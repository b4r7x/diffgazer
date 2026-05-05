import { Card as CardRoot, cardVariants, type CardProps } from "./card";
import { CardAction, type CardActionProps } from "./card-action";
import { CardContent, type CardContentProps } from "./card-content";
import { CardDescription, type CardDescriptionProps } from "./card-description";
import { CardFooter, type CardFooterProps } from "./card-footer";
import { CardHeader, type CardHeaderProps } from "./card-header";
import { CardLabel, cardLabelVariants, type CardLabelProps } from "./card-label";
import { CardTitle, type CardTitleProps } from "./card-title";

const Card = Object.assign(CardRoot, {
  Action: CardAction,
  Header: CardHeader,
  Label: CardLabel,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
});

export { Card, cardVariants, type CardProps };
export { CardAction, type CardActionProps };
export { CardHeader, type CardHeaderProps };
export { CardLabel, cardLabelVariants, type CardLabelProps };
export { CardTitle, type CardTitleProps };
export { CardDescription, type CardDescriptionProps };
export { CardContent, type CardContentProps };
export { CardFooter, type CardFooterProps };
