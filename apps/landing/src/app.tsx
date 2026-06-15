import { Footer } from "./components/footer";
import { Hero } from "./components/hero";
import { Install } from "./components/install";
import { Showcase } from "./components/showcase";
import { ValueProps } from "./components/value-props";
import { PRODUCT_NAME } from "./content";

export function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-sm focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-foreground"
      >
        Skip to content
      </a>
      <header className="mx-auto max-w-3xl px-4 pt-8">
        <span className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
          {PRODUCT_NAME}
        </span>
      </header>
      <main id="main" className="mx-auto flex max-w-3xl flex-col gap-24 px-4 py-16 sm:py-24">
        <Hero />
        <ValueProps />
        <Showcase />
        <Install />
      </main>
      <Footer />
    </>
  );
}
