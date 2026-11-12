import { format } from "date-fns";

export const SLOT_MIN = 5;
export const SLOT_MS = SLOT_MIN * 60_000;
export const MIN = 60_000;

export const floorToSlot = (ms: number) => Math.floor(ms / SLOT_MS) * SLOT_MS;
export const ceilToSlot = (ms: number) => Math.ceil(ms / SLOT_MS) * SLOT_MS;
export const fmtTime = (ms: number) => format(ms, "h:mm");
export const fmtTimeAmPm = (ms: number) => format(ms, "h:mm a");
export const fmtClock = (ms: number) => format(ms, "h:mm:ss");
export const fmtDay = (ms: number) => format(ms, "EEE d MMM, h:mm a");
export const minutesBetween = (a: number, b: number) => Math.round((b - a) / MIN);
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
