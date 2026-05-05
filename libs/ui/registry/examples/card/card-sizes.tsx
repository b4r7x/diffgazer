import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardLabel,
  CardTitle,
} from "@/components/ui/card"

export default function CardSizes() {
  return (
    <div className="space-y-8">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Small Card</CardTitle>
          <CardDescription>max-w-sm size</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Compact card layout.</p>
        </CardContent>
      </Card>

      <Card size="md">
        <CardLabel variant="gap">Inside Gap Label</CardLabel>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Use <code>variant="border"</code> for a boxed label or <code>variant="gap"</code> for a clean border cutout.
          </p>
        </CardContent>
      </Card>

      <Card size="lg" variant="panel">
        <CardHeader>
          <CardTitle>Panel Variant</CardTitle>
          <CardDescription>Elevated card treatment</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Opt in with variant="panel" when you need extra weight.</p>
        </CardContent>
      </Card>
    </div>
  )
}
