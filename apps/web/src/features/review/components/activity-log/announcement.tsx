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
  sourceFilter: string | undefined;
  /**
   * The pinned tail row's sentence without its ticking clock, so it is announced
   * when the run changes state and never once a second.
   */
  tailStatus?: string | null;
  enabled: boolean;
}

export function ActivityLogAnnouncement({
  tailEvent,
  latestEntry,
  sourceFilter,
  tailStatus = null,
  enabled,
}: ActivityLogAnnouncementProps) {
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnnouncementRef = useRef<LogAnnouncement | null>(null);
  const [announcement, setAnnouncement] = useState<LogAnnouncement | null>(null);
  const announcedTailRef = useRef(tailEvent);
  const announcedSourceFilterRef = useRef(sourceFilter);

  // The region is aria-atomic, so the tail row unmounting at the end of a run
  // re-reads whatever is left in it. Empty it with the run instead of announcing
  // a mid-run line again once the work is over.
  useEffect(() => {
    if (enabled) return;
    pendingAnnouncementRef.current = null;
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = null;
    }
    setAnnouncement(null);
  }, [enabled]);

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
      {tailStatus && <span key={tailStatus}>{tailStatus}</span>}
    </output>
  );
}
