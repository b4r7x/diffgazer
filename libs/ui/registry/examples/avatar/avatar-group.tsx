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

export default function AvatarGroupExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          overlap (default) — max=3
        </span>
        <AvatarGroup max={3} size="md">
          {users.map((u) => (
            <Avatar key={u.initials} fallback={u.initials} />
          ))}
        </AvatarGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          spacing="gap" — max=3
        </span>
        <AvatarGroup max={3} size="md" spacing="gap">
          {users.map((u) => (
            <Avatar key={u.initials} fallback={u.initials} />
          ))}
        </AvatarGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          responsive (no max) — resize to see
        </span>
        <div className="w-20 resize-x overflow-auto border border-dashed border-foreground/20 p-2">
          <AvatarGroup size="md">
            {users.map((u) => (
              <Avatar key={u.initials} fallback={u.initials} />
            ))}
          </AvatarGroup>
        </div>
      </div>
    </div>
  );
}
