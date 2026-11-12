import type { DemandRow, HeatCell, Kpis, SimulationAssumptions, SimulationPoint } from "@/types";
import { useAppStore } from "@/store/appStore";
import { ACTIVE, bookedBySlot, nextSlotsFrom, usableCapacity } from "@/lib/planning";
import { ratioToLoad } from "@/lib/load";
import { MIN, ceilToSlot } from "@/lib/time";
import { wait } from "./util";

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// TODO: replace with real API call
export async function getKpis(): Promise<Kpis> {
  await wait(300);
  const { orders, menu, stations } = useAppStore.getState();
  const now = Date.now();
  const today = orders.filter((o) => o.createdAt >= startOfDay(now) && o.status !== "cancelled");
  const waits = orders
    .filter((o) => o.collectedAt && o.createdAt >= startOfDay(now) && !o.mine)
    .map((o) => Math.max(0, (o.collectedAt! - o.slotTime) / MIN));
  const slots = nextSlotsFrom(ceilToSlot(now), 18);
  const booked = bookedBySlot(orders, menu);
  let used = 0,
    cap = 0;
  for (const t of slots)
    for (const s of stations) {
      used += Math.min(booked.get(t)?.[s.id] ?? 0, usableCapacity(s));
      cap += usableCapacity(s);
    }
  return {
    ordersToday: today.length,
    avgWaitMin: waits.length
      ? Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10
      : null,
    utilization: cap ? used / cap : 0,
    reslotted: orders.filter((o) => o.reslot).length,
  };
}

// TODO: replace with real API call
export async function getHeatmap(slotCount = 18): Promise<{ slots: number[]; cells: HeatCell[] }> {
  await wait(300);
  const { orders, menu, stations } = useAppStore.getState();
  const slots = nextSlotsFrom(ceilToSlot(Date.now()), slotCount);
  const booked = bookedBySlot(orders, menu);
  const cells = stations.flatMap((s) =>
    slots.map((t) => {
      const ratio = (booked.get(t)?.[s.id] ?? 0) / usableCapacity(s);
      return { station: s.id, slot: t, ratio, load: ratioToLoad(ratio) };
    }),
  );
  return { slots, cells };
}

// TODO: replace with real API call
export async function getDemand(): Promise<{ slots: number[]; rows: DemandRow[] }> {
  await wait(300);
  const { orders, menu } = useAppStore.getState();
  const slots = nextSlotsFrom(ceilToSlot(Date.now()), 18);
  const rows = new Map<string, DemandRow>();
  for (const o of orders) {
    if (!ACTIVE.includes(o.status)) continue;
    for (const l of o.items) {
      const m = menu.find((x) => x.id === l.itemId);
      if (!m) continue;
      const row = rows.get(m.id) ?? { itemId: m.id, itemName: m.name, bySlot: {}, total: 0 };
      row.bySlot[o.slotTime] = (row.bySlot[o.slotTime] ?? 0) + l.qty;
      row.total += l.qty;
      rows.set(m.id, row);
    }
  }
  return { slots, rows: [...rows.values()].sort((a, b) => b.total - a.total) };
}

/** Days of order history available for forecasting. Mock store has none yet. */
// TODO: replace with real API call
export async function getHistoryDays(): Promise<number> {
  await wait(100);
  return 0;
}

/** Arrival counts per minute across a 60-minute lunch rush (sample counter tally). */
const ARRIVAL_SHAPE = [
  0.2, 0.25, 0.3, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.92, 0.97, 1, 1, 0.98, 0.95, 0.9, 0.88, 0.85,
  0.82, 0.8, 0.78, 0.75, 0.7, 0.66, 0.62, 0.58, 0.55, 0.5, 0.47, 0.44, 0.4, 0.38, 0.35, 0.33, 0.3,
  0.28, 0.26, 0.24, 0.22, 0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.1, 0.1, 0.09,
  0.08, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.03,
];

export function simulate(a: SimulationAssumptions): SimulationPoint[] {
  const servicePerMin = (60 / Math.max(5, a.serviceSecPerOrder)) * Math.max(1, a.counters);
  const pickupPerMin = servicePerMin * 3; // handing over a packed order is ~3x faster than ordering + cooking
  let fifo = 0,
    walk = 0,
    pick = 0;
  return ARRIVAL_SHAPE.map((shape, minute) => {
    const arrivals = shape * a.peakArrivalsPerMin;
    fifo = Math.max(0, fifo + arrivals - servicePerMin);
    const walkIns = arrivals * (1 - a.preOrderShare);
    const preOrders = a.peakArrivalsPerMin * a.preOrderShare * 0.55; // spread evenly by slots
    walk = Math.max(0, walk + walkIns - servicePerMin);
    pick = Math.max(0, pick + preOrders - pickupPerMin);
    return {
      minute,
      fifo: Math.round(fifo * 10) / 10,
      dequeue: Math.round((walk + pick) * 10) / 10,
    };
  });
}
