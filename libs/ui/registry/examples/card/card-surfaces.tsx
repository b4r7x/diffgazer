import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CardSurfaces() {
  return (
    <div className="space-y-8">
      <Card surface="flat" size="md">
        <CardHeader>
          <CardTitle>Flat</CardTitle>
          <CardDescription>Default clean border</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Soft bordered card for everyday use.</p>
        </CardContent>
      </Card>

      <Card surface="stacked" size="md">
        <CardHeader>
          <CardTitle>Stacked</CardTitle>
          <CardDescription>Paper stack illusion</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Hard offset shadow creates depth.</p>
        </CardContent>
      </Card>

      <Card surface="inset" size="md">
        <CardHeader>
          <CardTitle>Inset</CardTitle>
          <CardDescription>Recessed into the page</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Stamped effect with inset shadow.</p>
        </CardContent>
      </Card>

      <Card surface="dotted" size="md">
        <CardHeader>
          <CardTitle>Dotted</CardTitle>
          <CardDescription>Blueprint wireframe style</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dashed border for draft or placeholder content.
          </p>
        </CardContent>
      </Card>

      <Card surface="glow" size="md">
        <CardHeader>
          <CardTitle>Glow</CardTitle>
          <CardDescription>Subtle edge luminance</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Soft outer glow for emphasis.</p>
        </CardContent>
      </Card>
    </div>
  );
}
