import type { ActivityEvent, AppNotification, CartItem, Order } from "@/types";
import { SEED_MENU } from "./menu";
import { MIN, SLOT_MS, ceilToSlot } from "@/lib/time";

const NAMES = ["Aarav", "Diya", "Rohan", "Ananya", "Kabir", "Meera", "Vihaan", "Ishita", "Arjun", "Sneha", "Karthik", "Priya", "Nikhil", "Tanvi", "Siddharth", "Riya", "Aditya", "Kavya", "Harsh", "Pooja", "Varun", "Neha", "Rahul", "Shruti", "Manav", "Divya", "Yash", "Aditi", "Pranav", "Lakshmi"];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const total = (items: CartItem[]) =>
  items.reduce((sum, l) => sum + (SEED_MENU.find((m) => m.id === l.itemId)?.price ?? 0) * l.qty, 0);

export function makeSeed(now: number) {
  const r = rng(42);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)]!;
  const popular = ["masala-dosa", "masala-dosa", "plain-dosa", "set-dosa", "idli-vada", "veg-noodles", "fried-rice", "samosa", "vada-pav", "veg-puff", "filter-coffee", "filter-coffee", "masala-chai", "masala-chai", "cold-coffee", "curd-rice", "lime-soda"];
  const base = ceilToSlot(now);
  const orders: Order[] = [];
  let number = 101;

  // 4 orders ready on shelves, 2 collected earlier today
  for (let i = 0; i < 6; i++) {
    const items: CartItem[] = [{ itemId: pick(popular), qty: 1 + Math.floor(r() * 2), modifiers: [] }];
    const slotTime = base - (i < 4 ? 1 : 3) * SLOT_MS;
    const ready = i < 4;
    orders.push({
      id: `o${number}`, number: number++, studentName: pick(NAMES), mine: false, items, total: total(items),
      slotTime, status: ready ? "ready" : "collected", payment: r() > 0.4 ? "upi" : "counter",
      createdAt: slotTime - 40 * MIN, readyAt: now - (i === 0 ? 12 : 2 + i) * MIN,
      ...(ready ? { shelf: i + 1 } : { collectedAt: slotTime + Math.round(1 + r() * 3) * MIN }),
    });
  }

  // ~40 upcoming orders across the next 90 minutes, peaking around lunch
  for (let i = 0; i < 40; i++) {
    const offsetSlots = Math.min(17, Math.floor(Math.abs((r() + r() + r()) / 3 - 0.35) * 26));
    const slotTime = base + (offsetSlots + 1) * SLOT_MS;
    const lines = 1 + Math.floor(r() * 2.4);
    const items: CartItem[] = [];
    for (let j = 0; j < lines; j++) {
      const itemId = pick(popular);
      const existing = items.find((x) => x.itemId === itemId);
      if (existing) existing.qty++;
      else items.push({ itemId, qty: r() > 0.8 ? 2 : 1, modifiers: itemId.includes("coffee") && r() > 0.6 ? ["less sugar"] : [] });
    }
    orders.push({
      id: `o${number}`, number: number++, studentName: pick(NAMES), mine: false, items, total: total(items),
      slotTime, status: "scheduled", payment: r() > 0.35 ? "upi" : "counter", createdAt: now - Math.floor(r() * 50) * MIN,
    });
  }

  // The signed-in student's own history
  const history: [string, number, number][] = [["masala-dosa", 1, 1], ["filter-coffee", 2, 1], ["veg-noodles", 1, 2], ["cold-coffee", 1, 2], ["vada-pav", 2, 3]];
  const days: Record<number, CartItem[]> = {};
  for (const [itemId, qty, d] of history) (days[d] ??= []).push({ itemId, qty, modifiers: [] });
  Object.entries(days).forEach(([d, items]) => {
    const t = now - Number(d) * 24 * 60 * MIN;
    orders.push({ id: `o${number}`, number: number++, studentName: "You", mine: true, items, total: total(items), slotTime: t, status: "collected", payment: "upi", createdAt: t - 30 * MIN, readyAt: t - MIN, collectedAt: t + 2 * MIN, shelf: 3 });
  });

  const activity: ActivityEvent[] = orders
    .filter((o) => !o.mine && o.createdAt <= now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8)
    .map((o) => ({ id: `a-${o.id}`, at: o.createdAt, kind: "order", text: `#${o.number} placed by ${o.studentName} · ₹${o.total}` }));

  const notifications: AppNotification[] = [];
  return { orders, activity, notifications, nextNumber: number };
}
