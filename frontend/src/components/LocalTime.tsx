"use client";

import { useHydrated } from "@/hooks/useHydrated";

const PRESETS = {
  /** Sat 18 Oct, 15:00 */
  kickoff: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  /** 15:00 */
  time: { hour: "2-digit", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * A date in the viewer's time zone. The server doesn't know that zone, so nothing is
 * rendered until hydration (avoids showing server-time kickoffs and hydration mismatches).
 */
export function LocalTime({ date, format = "kickoff" }: { date: Date | string | number; format?: keyof typeof PRESETS }) {
  const hydrated = useHydrated();
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} className="tabular-nums">
      {hydrated ? d.toLocaleString(undefined, PRESETS[format]) : " "}
    </time>
  );
}
