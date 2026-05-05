import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CardArticle() {
  return (
    <div className="space-y-6">
      <Card as="article" aria-labelledby="deploy-title" size="md">
        <CardHeader>
          <CardTitle id="deploy-title">Deploy Preview</CardTitle>
          <CardDescription>Production build from main branch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Status</span>
              <span className="font-bold text-success">READY</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Branch</span>
              <span className="font-mono">main</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Commit</span>
              <span className="font-mono">f3a1b2c</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="ghost">Logs</Button>
          <Button variant="primary">Visit</Button>
        </CardFooter>
      </Card>

      <Card as="article" aria-labelledby="review-title" size="md">
        <CardHeader>
          <CardTitle id="review-title">Code Review</CardTitle>
          <CardDescription>PR #42 awaiting approval</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            2 files changed, 14 additions, 3 deletions.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="ghost">Dismiss</Button>
          <Button variant="primary">Review</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
