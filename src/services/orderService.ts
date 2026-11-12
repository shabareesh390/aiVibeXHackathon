import type { CartItem, Order, OrderStatus, PaymentMethod } from "@/types";
import { useAppStore, uid } from "@/store/appStore";
import { wait } from "./util";

const priceOf = (items: CartItem[]) => {
  const { menu } = useAppStore.getState();
  return items.reduce((s, l) => s + (menu.find((m) => m.id === l.itemId)?.price ?? 0) * l.qty, 0);
};

export const cartTotal = priceOf;

export function calcPrepMinutes(items: CartItem[]): number {
  const { menu } = useAppStore.getState();
  return Math.max(
    4,
    ...items.map((l) => (menu.find((m) => m.id === l.itemId)?.durationMin ?? 0) + 2),
  );
}

// TODO: replace with real API call
export async function placeOrder(input: {
  items: CartItem[];
  slotTime: number;
  payment: PaymentMethod;
  studentName: string;
  instructions?: string | undefined;
}): Promise<Order> {
  await wait(400);
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
        body: `Ready by pickup slot. Estimated prep time: ~${prepMin} mins.`,
        at: Date.now(),
        read: false,
      },
      ...s.notifications,
    ],
  });
  return order;
}

// TODO: replace with real API call
export async function getOrder(id: string): Promise<Order | undefined> {
  await wait(100);
  return useAppStore.getState().orders.find((o) => o.id === id);
}

// TODO: replace with real API call
export async function getMyOrders(): Promise<Order[]> {
  await wait(200);
  return useAppStore
    .getState()
    .orders.filter((o) => o.mine)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// TODO: replace with real API call
export async function cancelOrder(id: string, reason = "Cancelled by student"): Promise<void> {
  await wait(200);
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
}

function nextAvailableShelf(orders: Order[]) {
  const used = new Set(orders.filter((o) => o.status === "ready").map((o) => o.shelf));
  for (let i = 1; i <= 30; i++) if (!used.has(i)) return i;
  return 30;
}

// TODO: replace with real API call
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  extra?: { shelf?: number; cancelReason?: string },
): Promise<void> {
  await wait(100);
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
}

// TODO: replace with real API call
export async function acknowledgeReslot(id: string): Promise<void> {
  await wait(100);
  const s = useAppStore.getState();
  useAppStore.setState({
    orders: s.orders.map((x) =>
      x.id === id && x.reslot ? { ...x, reslot: { ...x.reslot, acknowledged: true } } : x,
    ),
  });
}

// TODO: replace with real API call
export async function markNotificationsRead(): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({ notifications: s.notifications.map((n) => ({ ...n, read: true })) });
}
