import type { ReviewEvent } from "@diffgazer/core/review";
import type { LogEntryData } from "@diffgazer/core/schemas/presentation";
import { useEffect, useRef, useState } from "react";

const ACTIVITY_ANNOUNCEMENT_DELAY_MS = 750;

interface LogAnnouncement {
  id: string;
  message: string;
}

export interface ActivityLogAnnouncementProps {
  tailEvent: ReviewEvent | undefined;
  latestEntry: Pick<LogEntryData, "id" | "message"> | undefined;
  sourceFilter: string | null;
  enabled: boolean;
}

export function ActivityLogAnnouncement({
  tailEvent,
  latestEntry,
  sourceFilter,
  enabled,
}: ActivityLogAnnouncementProps) {
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnnouncementRef = useRef<LogAnnouncement | null>(null);
  const [announcement, setAnnouncement] = useState<LogAnnouncement | null>(null);
  const announcedTailRef = useRef(tailEvent);
  const announcedSourceFilterRef = useRef(sourceFilter);

  useEffect(() => {
    if (announcedSourceFilterRef.current !== sourceFilter) {
      announcedSourceFilterRef.current = sourceFilter;
      announcedTailRef.current = tailEvent;
      pendingAnnouncementRef.current = null;
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
        announcementTimerRef.current = null;
      }
      return;
    }
    if (announcedTailRef.current === tailEvent) return;
    announcedTailRef.current = tailEvent;
    if (!enabled || !latestEntry) return;
    pendingAnnouncementRef.current = { id: latestEntry.id, message: latestEntry.message };
    if (announcementTimerRef.current) return;
    announcementTimerRef.current = setTimeout(() => {
      announcementTimerRef.current = null;
      const nextAnnouncement = pendingAnnouncementRef.current;
      pendingAnnouncementRef.current = null;
      if (nextAnnouncement) setAnnouncement(nextAnnouncement);
    }, ACTIVITY_ANNOUNCEMENT_DELAY_MS);
  }, [enabled, latestEntry, sourceFilter, tailEvent]);

  useEffect(
    () => () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    },
    [],
  );

  return (
    <output aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement && <span key={announcement.id}>{announcement.message}</span>}
    </output>
  );
}
