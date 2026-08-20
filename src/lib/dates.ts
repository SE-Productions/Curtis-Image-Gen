import { format, parseISO } from "date-fns";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function asDay(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? "");
  const match = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text.slice(0, 10);
}

export function formatDay(value: unknown, pattern: string): string {
  const day = asDay(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return format(parseISO(day), pattern);
}

export function formatWhen(value: unknown, pattern: string): string {
  const date =
    value instanceof Date ? value : new Date(typeof value === "string" ? value : String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return format(date, pattern);
}

export function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

export function zonedDateTime(
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.parse(`${date}T${pad(hour)}:${pad(minute)}:00.000Z`);
  const offset = zoneOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - offset);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = asDay(date).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function dateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
