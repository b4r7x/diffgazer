import { Avatar, AvatarGroup } from "@/components/ui/avatar";

const users = [
  { initials: "JD" },
  { initials: "AB" },
  { initials: "CD" },
  { initials: "EF" },
  { initials: "GH" },
  { initials: "KL" },
  { initials: "MN" },
];

// AvatarGroup defaults its accessible name to "Avatars", so three groups on one
// page would all announce the same. Each caption doubles as its group's name.
const OVERLAP_CAPTION = "overlap (default) — max=3";
const GAP_CAPTION = 'spacing="gap" — max=3';
const RESPONSIVE_CAPTION = "responsive (no max) — resize to see";

export default function AvatarGroupExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground">{OVERLAP_CAPTION}</span>
        <AvatarGroup max={3} size="md" aria-label={OVERLAP_CAPTION}>
          {users.map((u) => (
            <Avatar key={u.initials} fallback={u.initials} />
          ))}
        </AvatarGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground">{GAP_CAPTION}</span>
        <AvatarGroup max={3} size="md" spacing="gap" aria-label={GAP_CAPTION}>
          {users.map((u) => (
            <Avatar key={u.initials} fallback={u.initials} />
          ))}
        </AvatarGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground">{RESPONSIVE_CAPTION}</span>
        <div className="w-20 resize-x overflow-auto border border-dashed border-foreground/20 p-2">
          <AvatarGroup size="md" aria-label={RESPONSIVE_CAPTION}>
            {users.map((u) => (
              <Avatar key={u.initials} fallback={u.initials} />
            ))}
          </AvatarGroup>
        </div>
      </div>
    </div>
  );
}
