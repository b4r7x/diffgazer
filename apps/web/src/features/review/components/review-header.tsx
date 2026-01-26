import { Button } from "@/components/ui/button"

export function ReviewHeader() {
    return (
        <div className="flex items-center justify-between border-b px-6 py-4 bg-background">
            <div>
                <h1 className="text-lg font-semibold">Code Review</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">Export Report</Button>
                <Button size="sm">Finish Review</Button>
            </div>
        </div>
    )
}
