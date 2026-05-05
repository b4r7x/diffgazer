import { Avatar } from "@/components/ui/avatar"

export default function AvatarDefault() {
  return (
    <div className="flex items-center gap-4">
      <Avatar
        src="https://api.dicebear.com/9.x/identicon/svg?seed=felix"
        alt="Felix"
        fallback="FX"
      />
      <Avatar fallback="JD" />
      <Avatar fallback="AB" size="lg" />
    </div>
  )
}
