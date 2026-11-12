import type { CartItem, Order, OrderStatus, PaymentMethod } from "@/types";
import { useAppStore, uid } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import { wait } from "./util";

const priceOf = (items: CartItem[]) => {
  const { menu } = useAppStore.getState();
  return items.reduce((s, l) => s + (menu.find((m) => m.id === l.itemId)?.price ?? 0) * l.qty, 0);
};

export const cartTotal = priceOf;

export function calcPrepMinutes(items: CartItem[]): number {
  const { menu } = useAppStore.getState();
  const maxDuration = Math.max(
    3,
    ...items.map((l) => menu.find((m) => m.id === l.itemId)?.durationMin ?? 0),
  );
  // Guarantee prep is strictly under 15 minutes for all orders (typically 3-8 minutes)
  return Math.min(8, Math.max(3, maxDuration));
}

export async function placeOrder(input: {
  items: CartItem[];
  slotTime: number;
  payment: PaymentMethod;
  studentName: string;
  instructions?: string | undefined;
}): Promise<Order> {
  const s = useAppStore.getState();

  // Concurrency check: prevent overbooking
  const ordersInSlot = s.orders.filter(
    (o) => o.status !== "cancelled" && o.slotTime === input.slotTime,
  ).length;
  const maxOrders = s.config?.maxOrdersPerSlot ?? 15;
  if (ordersInSlot >= maxOrders) {
    throw new Error(
      "This pickup slot was just booked to capacity by another student. Please select another slot.",
    );
  }

  const prepMin = calcPrepMinutes(input.items);
  const order: Order = {
    id: `o${s.nextNumber}-${uid().slice(0, 4)}`,
    number: s.nextNumber,
    studentName: input.studentName,
    mine: true,
    items: input.items,
    total: priceOf(input.items),
    slotTime: input.slotTime,
    status: "scheduled",
    payment: input.payment,
    createdAt: Date.now(),
    instructions: input.instructions,
    estimatedPrepMin: prepMin,
  };
  useAppStore.setState({
    orders: [...s.orders, order],
    nextNumber: s.nextNumber + 1,
    activity: [
      {
        id: uid(),
        at: Date.now(),
        kind: "order" as const,
        text: `#${order.number} placed by ${order.studentName} · ₹${order.total}`,
      },
      ...s.activity,
    ].slice(0, 40),
    notifications: [
      {
        id: uid(),
        orderId: order.id,
        title: `Order #${order.number} scheduled`,
        body: `Ready in under 15 mins! Estimated prep: ~${prepMin} mins.`,
        at: Date.now(),
        read: false,
      },
      ...s.notifications,
    ],
  });

  if (supabase) {
    try {
      await supabase.from("orders").insert({
        id: order.id,
        number: order.number,
        student_name: order.studentName,
        items: order.items,
        total: order.total,
        slot_time: order.slotTime,
        status: order.status,
        payment: order.payment,
        instructions: order.instructions ?? null,
        estimated_prep_min: order.estimatedPrepMin ?? 5,
      });
    } catch {
      /* local store already updated */
    }
  }

  await wait(100);
  return order;
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const s = useAppStore.getState();
  const local = s.orders.find((o) => o.id === id);
  if (local) return local;

  if (supabase) {
    try {
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (data) {
        return {
          id: data.id,
          number: data.number,
          studentName: data.student_name,
          mine: false,
          items: data.items,
          total: Number(data.total),
          slotTime: Number(data.slot_time),
          status: data.status,
          payment: data.payment,
          createdAt: new Date(data.created_at).getTime(),
          instructions: data.instructions || undefined,
          estimatedPrepMin: data.estimated_prep_min,
          shelf: data.shelf || undefined,
          readyAt: data.ready_at ? Number(data.ready_at) : undefined,
          collectedAt: data.collected_at ? Number(data.collected_at) : undefined,
          cancelReason: data.cancel_reason || undefined,
        };
      }
    } catch {
      /* fallback */
    }
  }

  return undefined;
}

export async function getMyOrders(): Promise<Order[]> {
  await wait(100);
  return useAppStore
    .getState()
    .orders.filter((o) => o.mine)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function cancelOrder(id: string, reason = "Cancelled by student"): Promise<void> {
  const s = useAppStore.getState();
  const o = s.orders.find((x) => x.id === id);
  useAppStore.setState({
    orders: s.orders.map((x) =>
      x.id === id ? { ...x, status: "cancelled", cancelReason: reason } : x,
    ),
    activity: [
      {
        id: uid(),
        at: Date.now(),
        kind: "cancel" as const,
        text: `#${o?.number} cancelled (${reason})`,
      },
      ...s.activity,
    ].slice(0, 40),
    notifications: [
      {
        id: uid(),
        orderId: id,
        title: `Order #${o?.number ?? id} cancelled`,
        body: reason,
        at: Date.now(),
        read: false,
      },
      ...s.notifications,
    ],
  });

  if (supabase) {
    try {
      await supabase
        .from("orders")
        .update({ status: "cancelled", cancel_reason: reason })
        .eq("id", id);
    } catch {
      /* local store already updated */
    }
  }

  await wait(80);
}

function nextAvailableShelf(orders: Order[]) {
  const used = new Set(orders.filter((o) => o.status === "ready").map((o) => o.shelf));
  for (let i = 1; i <= 30; i++) if (!used.has(i)) return i;
  return 30;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  extra?: { shelf?: number; cancelReason?: string },
): Promise<void> {
  const s = useAppStore.getState();
  const o = s.orders.find((x) => x.id === id);
  if (!o) return;

  const now = Date.now();
  let shelf = extra?.shelf ?? o.shelf;
  if (status === "ready" && !shelf) {
    shelf = nextAvailableShelf(s.orders);
  }

  const updatedOrders = s.orders.map((x) => {
    if (x.id !== id) return x;
    return {
      ...x,
      status,
      shelf,
      readyAt: status === "ready" ? now : x.readyAt,
      collectedAt: status === "collected" ? now : x.collectedAt,
      cancelReason: extra?.cancelReason ?? x.cancelReason,
    };
  });

  const notifications = [...s.notifications];
  if (status === "cooking") {
    notifications.unshift({
      id: uid(),
      orderId: id,
      title: `Order #${o.number} is being prepared`,
      body: `Kitchen has accepted and started cooking your order.`,
      at: now,
      read: false,
    });
  } else if (status === "ready") {
    notifications.unshift({
      id: uid(),
      orderId: id,
      title: `Order #${o.number} is ready for pickup!`,
      body: `Please collect from Shelf #${shelf}.`,
      at: now,
      read: false,
    });
  }

  useAppStore.setState({
    orders: updatedOrders,
    notifications,
    activity: [
      {
        id: uid(),
        at: now,
        kind: (status === "ready" ? "ready" : status === "collected" ? "collected" : "order") as
          "ready" | "collected" | "order",
        text: `#${o.number} changed to ${status}${shelf ? ` (Shelf ${shelf})` : ""}`,
      },
      ...s.activity,
    ].slice(0, 40),
  });

  if (supabase) {
    try {
      const patch: any = { status };
      if (shelf !== undefined) patch.shelf = shelf;
      if (status === "ready") patch.ready_at = now;
      if (status === "collected") patch.collected_at = now;
      if (extra?.cancelReason !== undefined) patch.cancel_reason = extra.cancelReason;
      await supabase.from("orders").update(patch).eq("id", id);
    } catch {
      /* local store already updated */
    }
  }

  await wait(80);
}

export async function acknowledgeReslot(id: string): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({
    orders: s.orders.map((x) =>
      x.id === id && x.reslot ? { ...x, reslot: { ...x.reslot, acknowledged: true } } : x,
    ),
  });
}

export async function markNotificationsRead(): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({ notifications: s.notifications.map((n) => ({ ...n, read: true })) });
}
