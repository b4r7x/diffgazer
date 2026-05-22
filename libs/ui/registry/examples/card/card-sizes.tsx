import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardLabel,
  CardTitle,
} from "@/components/ui/card"
import { InlineCode } from "@/components/ui/code-block"

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
            Use <InlineCode>variant="border"</InlineCode> for a boxed label or <InlineCode>variant="gap"</InlineCode> for a clean border cutout.
          </p>
        </CardContent>
      </Card>

      <Card size="lg" surface="stacked">
        <CardHeader>
          <CardTitle>Stacked Surface</CardTitle>
          <CardDescription>Paper stack depth effect</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Opt in with surface="stacked" when you need extra weight.</p>
        </CardContent>
      </Card>
    </div>
  )
}
