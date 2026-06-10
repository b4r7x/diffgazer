import { buttonVariants } from "@diffgazer/ui/components/button";
import { cn } from "@diffgazer/ui/lib/utils";
import type { AnyRouter, LinkComponentProps, RegisteredRouter } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const BRACKET_LINK_CLASS =
  "font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export type TuiBracketLinkProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = "",
> = LinkComponentProps<"a", TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
  variant?: "primary" | "muted";
  children: ReactNode;
};

export function TuiBracketLink<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = "",
>({
  variant = "muted",
  className,
  children,
  ...props
}: TuiBracketLinkProps<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>) {
  const variantClass =
    variant === "primary" ? buttonVariants({ variant: "primary" }) : BRACKET_LINK_CLASS;

  // TypeScript cannot relate the rest object back to Link's generic signature
  // after destructuring; createLink is not used so tests can mock the router module.
  const linkProps = props as LinkComponentProps<"a">;

  return (
    <Link {...linkProps} className={cn(variantClass, className)}>
      <span aria-hidden="true">[</span> {children} <span aria-hidden="true">]</span>
    </Link>
  );
}
