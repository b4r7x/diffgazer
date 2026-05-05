import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CardActionExample() {
  return (
    <Card size="md">
      <CardHeader>
        <CardTitle>Deploy Preview</CardTitle>
        <CardDescription>Production build from main branch</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            ···
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-border">
            <span className="text-muted-foreground">Status</span>
            <span className="font-bold text-success">READY</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Branch</span>
            <span className="font-mono">main</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost">Logs</Button>
        <Button variant="primary">Visit</Button>
      </CardFooter>
    </Card>
  )
}
