import { Divider } from "@/components/ui/divider"

export default function DividerDecorative() {
  return (
    <div className="w-full space-y-4">
      <section>
        <h3 className="text-sm font-medium">Account Settings</h3>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences.</p>
      </section>
      <Divider decorative={false} />
      <section>
        <h3 className="text-sm font-medium">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">Irreversible actions like account deletion.</p>
      </section>
    </div>
  )
}
