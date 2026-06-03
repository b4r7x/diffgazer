import { Button } from "@diffgazer/ui/components/button";
import {
  DOCS_LINK_TEXT,
  DOCS_URL,
  GITHUB_URL,
  HERO_DESCRIPTION,
  PRODUCT_NAME,
  TAGLINE,
} from "../content";

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <h1 className="font-mono text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {PRODUCT_NAME}
      </h1>
      <p className="max-w-xl text-balance text-lg text-foreground/90">{TAGLINE}</p>
      <p className="max-w-xl text-balance font-sans text-muted-foreground">
        {HERO_DESCRIPTION}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button as="a" href="#install" variant="primary">
          Install
        </Button>
        <Button as="a" href={DOCS_URL} variant="secondary">
          {DOCS_LINK_TEXT}
        </Button>
        <Button as="a" href={GITHUB_URL} variant="secondary">
          GitHub
        </Button>
      </div>
    </section>
  );
}
