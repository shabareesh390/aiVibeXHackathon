import type { CartItem, PickupWindow, Slot, StationId } from "@/types";
import { useAppStore } from "@/store/appStore";
import { bookedBySlot, stationDemand, usableCapacity } from "@/lib/planning";
import { ratioToLoad } from "@/lib/load";
import { MIN, SLOT_MS, ceilToSlot } from "@/lib/time";
import { wait } from "./util";

/** Minutes of prep the cart needs before its earliest pickup. */
export function prepMinutes(cart: CartItem[]) {
  const { menu } = useAppStore.getState();
  return Math.max(
    4,
    ...cart.map((l) => (menu.find((m) => m.id === l.itemId)?.durationMin ?? 0) + 2),
  );
}

/**
 * Capacity check per station per 5-minute slot, after holding back the walk-in reserve.
 * TODO: replace with real API call
 */
export async function getSlots(cart: CartItem[], window: PickupWindow): Promise<Slot[]> {
  await wait(500);
  const { menu, stations, orders } = useAppStore.getState();
  const now = Date.now();
  const need = stationDemand(cart, menu);
  const booked = bookedBySlot(orders, menu);
  const earliest = ceilToSlot(now + prepMinutes(cart) * MIN);
  const start = window.asap ? earliest : Math.max(earliest, ceilToSlot(window.start ?? earliest));
  const end = window.asap ? earliest + 90 * MIN : Math.max(start, window.end ?? start + 60 * MIN);

  const slots: Slot[] = [];
  for (let t = start; t <= end; t += SLOT_MS) {
    let worst = { station: "packing" as StationId, ratio: 0, left: Infinity };
    for (const s of stations) {
      if (need[s.id] === 0) continue;
      const used = booked.get(t)?.[s.id] ?? 0;
      const cap = usableCapacity(s);
      const ratio = (used + need[s.id]) / cap;
      const left = Math.max(0, Math.floor((cap - used) / need[s.id]));
      if (ratio > worst.ratio) worst = { station: s.id, ratio, left };
    }
    const load = ratioToLoad(worst.ratio > 1 ? 1 : worst.ratio === 1 ? 0.99 : worst.ratio);
    const full = worst.ratio > 1;
    const stationName = stations.find((s) => s.id === worst.station)?.name.toLowerCase();
    const reason = full
      ? `Full: ${stationName} station is booked out`
      : load === "amber"
        ? `Busy: ${stationName} station is nearly full`
        : `Quiet: ready within 2 min of arrival`;
    slots.push({
      startTime: t,
      readyBy: t - MIN,
      load: full ? "red" : load,
      reason,
      capacityLeft: full ? 0 : worst.left,
    });
  }

  // Recommend: earliest free slot, earliest any-open slot, and the quietest overall
  const open = slots.filter((s) => s.load !== "red");
  const picks = new Set<number>();
  const firstGreen = open.find((s) => s.load === "green");
  if (open[0]) picks.add(open[0].startTime);
  if (firstGreen) picks.add(firstGreen.startTime);
  for (const s of [...open].sort((a, b) =>
    a.load === b.load ? a.startTime - b.startTime : a.load === "green" ? -1 : 1,
  )) {
    if (picks.size >= 3) break;
    picks.add(s.startTime);
  }
  return slots.map((s) => ({ ...s, recommended: picks.has(s.startTime) }));
}
