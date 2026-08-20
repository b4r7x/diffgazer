import { Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Hover and focus-visible only exist under a pointer or a keyboard, so the
// matrix below applies the same treatments statically: each string is the
// unprefixed twin of a `hover:` / `focus-visible:` class in cardVariants, which
// keeps the deltas reviewable in a screenshot. Real usage never needs them —
// the interactive prop applies them for you.
const FORCED_HOVER = {
  flat: "border-border bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))]",
  stacked:
    "border-border bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))] shadow-[5px_5px_0_0_var(--background),6px_6px_0_0_color-mix(in_oklab,var(--foreground)_45%,transparent)]",
  inset: "border-border bg-[color-mix(in_oklab,var(--foreground)_10%,var(--background))]",
  dotted: "border-border bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))]",
  glow: "border-border outline-foreground/70 bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))]",
} as const;

const FORCED_FOCUS = "outline-2 outline-ring outline-offset-0";

const SURFACES = [
  { surface: "flat", delta: "border brightens" },
  { surface: "stacked", delta: "offset plate grows" },
  { surface: "inset", delta: "recessed fill deepens" },
  { surface: "dotted", delta: "dashed border brightens" },
  { surface: "glow", delta: "outer edge strengthens" },
] as const;

export default function CardInteractive() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Rest / hover / focus — states forced statically
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {SURFACES.map(({ surface, delta }) => (
            <Fragment key={surface}>
              <SwatchCard surface={surface} label="rest" />
              <SwatchCard
                surface={surface}
                label={`hover — ${delta}`}
                force={FORCED_HOVER[surface]}
              />
              <SwatchCard surface={surface} label="focus-visible ring" force={FORCED_FOCUS} />
            </Fragment>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Live — hover or Tab into each card
        </p>
        <Card
          as="a"
          href="#flat"
          surface="flat"
          size="md"
          interactive
          className="block no-underline"
        >
          <CardHeader>
            <CardTitle>Flat Interactive</CardTitle>
            <CardDescription>Tab to focus, hover to see border brighten</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Cursor and background shift on hover.</p>
          </CardContent>
        </Card>

        <Card
          as="a"
          href="#stacked"
          surface="stacked"
          size="md"
          interactive
          className="block no-underline"
        >
          <CardHeader>
            <CardTitle>Stacked Interactive</CardTitle>
            <CardDescription>Tab to focus, hover to see the offset plate grow</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">The paper stack deepens on hover.</p>
          </CardContent>
        </Card>

        <Card
          as="a"
          href="#inset"
          surface="inset"
          size="md"
          interactive
          className="block no-underline"
        >
          <CardHeader>
            <CardTitle>Inset Interactive</CardTitle>
            <CardDescription>Tab to focus, hover to see the fill deepen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The recessed fill steps further on hover.
            </p>
          </CardContent>
        </Card>

        <Card
          as="a"
          href="#dotted"
          surface="dotted"
          size="md"
          interactive
          className="block no-underline"
        >
          <CardHeader>
            <CardTitle>Dotted Interactive</CardTitle>
            <CardDescription>Tab to focus, hover to see the dashed border brighten</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">The dashed border brightens on hover.</p>
          </CardContent>
        </Card>

        <Card
          as="button"
          type="button"
          surface="glow"
          size="md"
          interactive
          className="block w-full text-left"
        >
          <span className="block px-4 py-3 text-xl font-bold tracking-wide">Glow Interactive</span>
          <span className="block px-4 pb-4 text-sm text-muted-foreground">
            Rendered as a button — it takes keyboard focus; the outer edge strengthens on hover.
          </span>
        </Card>
      </section>
    </div>
  );
}

function SwatchCard({
  surface,
  label,
  force,
}: {
  surface: (typeof SURFACES)[number]["surface"];
  label: string;
  force?: string;
}) {
  return (
    <Card surface={surface} className={force}>
      <span className="block px-4 py-3 font-mono text-xs">
        <span className="block font-bold">{surface}</span>
        <span className="block text-muted-foreground">{label}</span>
      </span>
    </Card>
  );
}
