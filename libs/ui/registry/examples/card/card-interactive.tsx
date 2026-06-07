import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CardInteractive() {
  return (
    <div className="space-y-8">
      <Card surface="flat" size="md" interactive>
        <CardHeader>
          <CardTitle>Flat Interactive</CardTitle>
          <CardDescription>Hover to see border brighten</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cursor and background shift on hover.</p>
        </CardContent>
      </Card>

      <Card surface="stacked" size="md" interactive>
        <CardHeader>
          <CardTitle>Stacked Interactive</CardTitle>
          <CardDescription>Hover to see shadow grow</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The paper stack deepens on hover.</p>
        </CardContent>
      </Card>

      <Card surface="inset" size="md" interactive>
        <CardHeader>
          <CardTitle>Inset Interactive</CardTitle>
          <CardDescription>Hover to see shadow deepen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The inner shadow intensifies on hover.</p>
        </CardContent>
      </Card>

      <Card surface="dotted" size="md" interactive>
        <CardHeader>
          <CardTitle>Dotted Interactive</CardTitle>
          <CardDescription>Hover to see border solidify</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The dashed border brightens on hover.</p>
        </CardContent>
      </Card>

      <Card surface="glow" size="md" interactive>
        <CardHeader>
          <CardTitle>Glow Interactive</CardTitle>
          <CardDescription>Hover to see glow intensify</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The edge glow brightens on hover.</p>
        </CardContent>
      </Card>
    </div>
  );
}
