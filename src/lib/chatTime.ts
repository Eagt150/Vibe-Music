import type { Locale } from "@/types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "2 d 5 h" / "3 h" / "12 min" — how long until a message is deleted. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 min";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return `${hours} h`;
  return `${Math.max(1, Math.floor(ms / 60000))} min`;
}

/** Time for a message bubble or a chat list row: "14:32" today, otherwise
 * the short weekday (messages never live longer than 3 days). */
export function formatChatTime(ts: number, locale: Locale): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatAgo(ts: number, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = ts - Date.now();
  if (Math.abs(diff) < HOUR) return rtf.format(Math.round(diff / 60000), "minute");
  if (Math.abs(diff) < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  return rtf.format(Math.round(diff / DAY), "day");
}
