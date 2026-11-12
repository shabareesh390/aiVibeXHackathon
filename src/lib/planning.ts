import type { Batch, CartItem, Load, MenuItem, Order, Station, StationId } from "@/types";
import { MIN, SLOT_MS, floorToSlot } from "./time";
import { ratioToLoad } from "./load";
import { WALK_IN_RESERVE } from "@/mock/menu";

export const ACTIVE: Order["status"][] = ["placed", "scheduled", "cooking"];

/** Units each cart line uses at its station, plus 1 packing unit per order. */
export function stationDemand(items: CartItem[], menu: MenuItem[]): Record<StationId, number> {
  const d: Record<StationId, number> = { tawa: 0, fryer: 0, beverage: 0, packing: 1 };
  for (const line of items) {
    const m = menu.find((x) => x.id === line.itemId);
    if (!m) continue;
    d[m.station] += line.qty;
  }
  return d;
}

export const usableCapacity = (s: Station) => Math.floor(s.capacityPerSlot * (1 - WALK_IN_RESERVE));

/** Booked units per station per slot start. */
export function bookedBySlot(orders: Order[], menu: MenuItem[]) {
  const map = new Map<number, Record<StationId, number>>();
  for (const o of orders) {
    if (!ACTIVE.includes(o.status)) continue;
    const key = floorToSlot(o.slotTime);
    const cur = map.get(key) ?? { tawa: 0, fryer: 0, beverage: 0, packing: 0 };
    const d = stationDemand(o.items, menu);
    (Object.keys(d) as StationId[]).forEach((k) => (cur[k] += d[k]));
    map.set(key, cur);
  }
  return map;
}

export function slotStationRatio(
  booked: Map<number, Record<StationId, number>>,
  slot: number,
  station: Station,
  extra = 0,
) {
  const used = (booked.get(slot)?.[station.id] ?? 0) + extra;
  return used / usableCapacity(station);
}

export function loadFor(ratio: number): Load {
  return ratioToLoad(ratio);
}

export const batchKey = (itemId: string, slot: number) => `${itemId}@${slot}`;

/** Group active orders into cooking batches per item per pickup slot. */
export function buildBatches(
  orders: Order[],
  menu: MenuItem[],
  stations: Station[],
  progress: Record<string, "started" | "done">,
  now: number,
): Batch[] {
  const groups = new Map<string, Batch>();
  for (const o of orders) {
    if (!["scheduled", "cooking", "placed"].includes(o.status)) continue;
    for (const line of o.items) {
      const m = menu.find((x) => x.id === line.itemId);
      if (!m || m.station === "packing") continue;
      const key = batchKey(m.id, o.slotTime);
      const g = groups.get(key);
      if (g) {
        g.qty += line.qty;
        if (!g.orderIds.includes(o.id)) g.orderIds.push(o.id);
      } else {
        groups.set(key, {
          key,
          itemId: m.id,
          itemName: m.name,
          station: m.station,
          qty: line.qty,
          startTime: 0,
          pickupTime: o.slotTime,
          orderIds: [o.id],
          state: "upcoming",
        });
      }
    }
  }
  const list = [...groups.values()].map((b) => {
    const m = menu.find((x) => x.id === b.itemId)!;
    const st = stations.find((s) => s.id === m.station)!;
    const rounds = Math.ceil(b.qty / (m.batchSize * st.parallel));
    const cookMin = rounds * m.durationMin;
    const startTime = b.pickupTime - (cookMin + 2) * MIN;
    const p = progress[b.key];
    let state: Batch["state"] = "upcoming";
    if (p === "done") state = "done";
    else if (p === "started") state = "cooking";
    else if (now > startTime + 2 * MIN) state = "overdue";
    else if (now >= startTime - 2 * MIN) state = "start-now";
    return { ...b, startTime, state };
  });
  return list.filter((b) => b.state !== "done").sort((a, b) => a.startTime - b.startTime);
}

export const nextSlotsFrom = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => floorToSlot(from) + i * SLOT_MS);
