import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CardInteractive() {
  return (
    <div className="space-y-8">
      <Card as="a" href="#flat" surface="flat" size="md" interactive className="block no-underline">
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
          <CardDescription>Tab to focus, hover to see shadow grow</CardDescription>
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
          <CardDescription>Tab to focus, hover to see shadow deepen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The inner shadow intensifies on hover.</p>
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
          <CardDescription>Tab to focus, hover to see border solidify</CardDescription>
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
        onClick={() => undefined}
        className="block w-full text-left"
      >
        <span className="block px-4 py-3 text-xl font-bold tracking-wide">Glow Interactive</span>
        <span className="block px-4 pb-4 text-sm text-muted-foreground">
          Rendered as a button — Enter/Space activate it; the edge glow brightens on hover.
        </span>
      </Card>
    </div>
  );
}
