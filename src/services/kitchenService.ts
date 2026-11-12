import type { Batch, Order, ReplanInput, StationLoad } from "@/types";
import { useAppStore, uid } from "@/store/appStore";
import { batchKey, bookedBySlot, buildBatches, usableCapacity } from "@/lib/planning";
import { ratioToLoad } from "@/lib/load";
import { MIN, SLOT_MS, ceilToSlot, floorToSlot, fmtTime } from "@/lib/time";
import { wait } from "./util";

/** Pure read used by live screens; kept sync so the kitchen re-renders every tick. */
export function selectBatches(now: number): Batch[] {
  const s = useAppStore.getState();
  return buildBatches(s.orders, s.menu, s.stations, s.batchProgress, now);
}

export function selectStationLoads(now: number): StationLoad[] {
  const s = useAppStore.getState();
  const booked = bookedBySlot(s.orders, s.menu);
  const slot = ceilToSlot(now);
  return s.stations.map((st) => {
    const used = Math.max(...[0, 1, 2, 3].map((i) => booked.get(slot + i * SLOT_MS)?.[st.id] ?? 0)); // next 20 min
    const ratio = used / usableCapacity(st);
    return { station: st.id, name: st.name, ratio, load: ratioToLoad(ratio) };
  });
}

// TODO: replace with real API call
export async function getBatches(): Promise<Batch[]> {
  await wait(150);
  return selectBatches(Date.now());
}

function nextShelf(orders: Order[]) {
  const used = new Set(orders.filter((o) => o.status === "ready").map((o) => o.shelf));
  for (let i = 1; i <= 30; i++) if (!used.has(i)) return i;
  return 30;
}

// TODO: replace with real API call
export async function markBatch(batch: Batch, state: "started" | "done"): Promise<void> {
  await wait(80);
  const s = useAppStore.getState();
  const progress = { ...s.batchProgress, [batch.key]: state };
  const now = Date.now();
  let orders = s.orders.map((o) => (batch.orderIds.includes(o.id) && o.status === "scheduled" ? { ...o, status: "cooking" as const } : o));
  const notifications = [...s.notifications];
  const activity = [...s.activity];
  if (state === "done") {
    orders = orders.map((o) => {
      if (!batch.orderIds.includes(o.id) || o.status === "ready") return o;
      const allDone = o.items.every((l) => {
        const m = s.menu.find((x) => x.id === l.itemId);
        return !m || m.station === "packing" || progress[batchKey(l.itemId, o.slotTime)] === "done";
      });
      if (!allDone) return o;
      const shelf = nextShelf(orders);
      notifications.unshift({ id: uid(), orderId: o.id, title: `Order #${o.number} is ready`, body: `Pick it up from shelf ${shelf}.`, at: now, read: false });
      activity.unshift({ id: uid(), at: now, kind: "ready", text: `#${o.number} ready on shelf ${shelf}` });
      return { ...o, status: "ready" as const, shelf, readyAt: now };
    });
  }
  useAppStore.setState({ batchProgress: progress, orders, notifications, activity: activity.slice(0, 40) });
}

// TODO: replace with real API call
export async function markCollected(orderId: string): Promise<void> {
  await wait(80);
  const s = useAppStore.getState();
  const o = s.orders.find((x) => x.id === orderId);
  useAppStore.setState({
    orders: s.orders.map((x) => (x.id === orderId ? { ...x, status: "collected" as const, collectedAt: Date.now() } : x)),
    activity: [{ id: uid(), at: Date.now(), kind: "collected" as const, text: `#${o?.number} collected by ${o?.studentName}` }, ...s.activity].slice(0, 40),
  });
}

/**
 * Re-plan after a delay or a station outage. Returns affected orders.
 * TODO: replace with real API call
 */
export async function replan(input: ReplanInput): Promise<Order[]> {
  await wait(500);
  const s = useAppStore.getState();
  const now = Date.now();
  const affected: Order[] = [];
  const notifications = [...s.notifications];
  const reason = input.type === "delay" ? "the kitchen is running behind" : `the ${s.stations.find((x) => x.id === input.station)?.name.toLowerCase()} station is down`;
  const downUntil = input.type === "stationDown" ? ceilToSlot(now + input.minutes * MIN) : 0;

  const orders = s.orders.map((o) => {
    if (!["scheduled", "cooking", "placed"].includes(o.status)) return o;
    let to = o.slotTime;
    if (input.type === "delay") {
      to = o.slotTime + input.minutes * MIN;
    } else {
      const uses = o.items.some((l) => s.menu.find((m) => m.id === l.itemId)?.station === input.station);
      if (!uses || o.slotTime >= downUntil) return o;
      to = o.slotTime + (downUntil - floorToSlot(now)); // shift by the outage, keeping order spacing
    }
    if (to === o.slotTime) return o;
    const moved: Order = { ...o, slotTime: to, reslot: { from: o.reslot?.from ?? o.slotTime, to, reason, acknowledged: false } };
    affected.push(moved);
    notifications.unshift({ id: uid(), orderId: o.id, title: `Pickup moved to ${fmtTime(to)}`, body: `Your pickup moved from ${fmtTime(o.slotTime)} to ${fmtTime(to)} because ${reason}.`, at: now, read: false });
    return moved;
  });

  // Moved orders get fresh batches; keep progress keyed to their new slot
  const progress: Record<string, "started" | "done"> = { ...s.batchProgress };
  for (const before of s.orders) {
    const after = affected.find((a) => a.id === before.id);
    if (!after) continue;
    for (const l of before.items) {
      const old = progress[batchKey(l.itemId, before.slotTime)];
      if (old) progress[batchKey(l.itemId, after.slotTime)] = old;
    }
  }

  useAppStore.setState({
    orders, notifications, batchProgress: progress,
    activity: [{ id: uid(), at: now, kind: "replan" as const, text: `Re-planned: ${affected.length} orders moved because ${reason}` }, ...s.activity].slice(0, 40),
  });
  return affected;
}
