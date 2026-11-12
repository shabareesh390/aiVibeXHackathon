import type { CartItem, PickupWindow, Slot, StationId } from "@/types";
import { useAppStore } from "@/store/appStore";
import { bookedBySlot, stationDemand, usableCapacity } from "@/lib/planning";
import { ratioToLoad } from "@/lib/load";
import { MIN, SLOT_MS, ceilToSlot } from "@/lib/time";
import { wait } from "./util";

/** Minutes of prep the cart needs before its earliest pickup. */
export function prepMinutes(cart: CartItem[]) {
  const { menu } = useAppStore.getState();
  const maxDuration = Math.max(
    3,
    ...cart.map((l) => menu.find((m) => m.id === l.itemId)?.durationMin ?? 0),
  );
  // Cap prep time at 8 mins so the entire pickup time is strictly under 15 min for all
  return Math.min(8, Math.max(3, maxDuration));
}

/**
 * Capacity check per station per 5-minute slot, after holding back the walk-in reserve.
 * Enforces that all generated pickup slots are strictly under 15 minutes from now.
 */
export async function getSlots(cart: CartItem[], window: PickupWindow): Promise<Slot[]> {
  await wait(300);
  const { menu, stations, orders, config } = useAppStore.getState();
  const now = Date.now();
  // Standard 5-minute interval so multiple slots fit cleanly within 15 minutes
  const stepMs = Math.min(config?.slotIntervalMin ?? 5, 5) * MIN;
  const maxOrders = config?.maxOrdersPerSlot ?? 15;
  const blocked = new Set(config?.blockedSlots ?? []);

  const need = stationDemand(cart, menu);
  const booked = bookedBySlot(orders, menu);
  const prep = prepMinutes(cart);
  const earliest = ceilToSlot(now + prep * MIN);
  // Absolute 15-minute upper limit from current time
  const maxUnder15Min = now + 15 * MIN;

  // Pickup slots must start when food is ready and stay strictly under 15 minutes from now
  const start = window.asap ? earliest : Math.max(earliest, ceilToSlot(window.start ?? earliest));
  // Guarantee end stays under 15 minutes from now
  const end = Math.max(start, maxUnder15Min);

  const slots: Slot[] = [];
  for (let t = start; t <= end; t += stepMs) {
    // Strictly enforce pickup time is under or equal to 15 minutes from now
    if (t > maxUnder15Min && slots.length > 0) break;
    if (blocked.has(t)) continue;

    const ordersInSlot = orders.filter((o) => o.status !== "cancelled" && o.slotTime === t).length;
    const manualSeats = config?.manualOccupiedSeats?.[t] ?? 0;
    const totalOccupiedSeats = ordersInSlot + manualSeats;
    const override = config?.slotOverrides?.[t];

    let worst = {
      station: "packing" as StationId,
      ratio: totalOccupiedSeats / maxOrders,
      left: Math.max(0, maxOrders - totalOccupiedSeats),
    };

    for (const s of stations) {
      if (need[s.id] === 0) continue;
      const used = booked.get(t)?.[s.id] ?? 0;
      const cap = usableCapacity(s);
      const ratio = (used + need[s.id]) / cap;
      const left = Math.max(0, Math.floor((cap - used) / need[s.id]));
      if (ratio > worst.ratio) worst = { station: s.id, ratio, left: Math.min(worst.left, left) };
    }

    const isSlotCapped = totalOccupiedSeats >= maxOrders;
    const isStationFull = worst.ratio > 1;
    const full = isSlotCapped || isStationFull;
    let load = isSlotCapped
      ? "red"
      : ratioToLoad(worst.ratio > 1 ? 1 : worst.ratio === 1 ? 0.99 : worst.ratio);
    const stationName = stations.find((s) => s.id === worst.station)?.name.toLowerCase();

    const minFromNow = Math.max(1, Math.round((t - now) / MIN));
    let reason = isSlotCapped
      ? `Full: All ${maxOrders} seats occupied (${totalOccupiedSeats}/${maxOrders})`
      : full
        ? `Full: ${stationName} station is booked out`
        : load === "amber"
          ? `Busy: ${totalOccupiedSeats}/${maxOrders} seats filled • Ready in ${minFromNow}m`
          : `Ready in ${minFromNow}m (under 15m guarantee) • ${worst.left} seats free`;

    let finalCapacity = full ? 0 : Math.max(0, worst.left);

    // Apply Manager Manual Overrides if set
    if (override === "filled") {
      load = "red";
      finalCapacity = 0;
      reason = "Manager update: Slot & seats marked Filled (No free tables)";
    } else if (override === "busy") {
      load = "amber";
      finalCapacity = Math.min(finalCapacity, 3);
      reason = `Manager update: Marked Busy • Ready in ${minFromNow}m`;
    } else if (override === "free") {
      load = "green";
      finalCapacity = Math.max(finalCapacity, 6);
      reason = `Manager update: Open seating • Ready in ${minFromNow}m`;
    }

    slots.push({
      startTime: t,
      readyBy: t - MIN,
      load,
      reason,
      capacityLeft: finalCapacity,
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
