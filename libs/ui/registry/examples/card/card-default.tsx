import {
  Card,
  CardContent,
  CardFooter,
  CardLabel,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CardDefault() {
  return (
    <Card size="md">
      <CardLabel variant="border">Repository</CardLabel>
      <CardContent className="pt-6">
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">Simple bordered card with floating border label.</p>
          <div className="flex justify-between py-1 border-b border-border">
            <span className="text-muted-foreground">Branch</span>
            <span className="font-mono">main</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border">
            <span className="text-muted-foreground">Commit</span>
            <span className="font-mono">a1b2c3d</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Status</span>
            <span className="font-bold text-success">PASS</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="px-4 py-3">
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Save</Button>
      </CardFooter>
    </Card>
  )
}
