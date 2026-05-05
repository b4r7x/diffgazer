import { Button } from "@/components/ui/button"

export default function ButtonDefault() {
  return (
    <div className="flex items-center gap-3">
      <Button variant="primary">Submit</Button>
      <Button variant="ghost">Cancel</Button>
      <Button bracket>Submit</Button>
    </div>
  )
}
