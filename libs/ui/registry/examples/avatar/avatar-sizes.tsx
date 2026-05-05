import { Avatar } from "@/components/ui/avatar"

export default function AvatarSizes() {
  return (
    <div className="flex items-center gap-4">
      <Avatar fallback="SM" size="sm" />
      <Avatar fallback="MD" size="md" />
      <Avatar fallback="LG" size="lg" />
    </div>
  )
}
