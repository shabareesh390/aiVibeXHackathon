import type { CartItem, Order, PaymentMethod } from "@/types";
import { useAppStore, uid } from "@/store/appStore";
import { wait } from "./util";

const priceOf = (items: CartItem[]) => {
  const { menu } = useAppStore.getState();
  return items.reduce((s, l) => s + (menu.find((m) => m.id === l.itemId)?.price ?? 0) * l.qty, 0);
};

export const cartTotal = priceOf;

// TODO: replace with real API call
export async function placeOrder(input: { items: CartItem[]; slotTime: number; payment: PaymentMethod; studentName: string }): Promise<Order> {
  await wait(700);
  const s = useAppStore.getState();
  const order: Order = {
    id: `o${s.nextNumber}-${uid().slice(0, 4)}`, number: s.nextNumber, studentName: input.studentName, mine: true,
    items: input.items, total: priceOf(input.items), slotTime: input.slotTime, status: "scheduled",
    payment: input.payment, createdAt: Date.now(),
  };
  useAppStore.setState({
    orders: [...s.orders, order],
    nextNumber: s.nextNumber + 1,
    activity: [{ id: uid(), at: Date.now(), kind: "order" as const, text: `#${order.number} placed by ${order.studentName} · ₹${order.total}` }, ...s.activity].slice(0, 40),
    notifications: [{ id: uid(), orderId: order.id, title: `Order #${order.number} scheduled`, body: "We'll start cooking so it's hot when you arrive.", at: Date.now(), read: false }, ...s.notifications],
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
  return useAppStore.getState().orders.filter((o) => o.mine).sort((a, b) => b.createdAt - a.createdAt);
}

// TODO: replace with real API call
export async function cancelOrder(id: string): Promise<void> {
  await wait(300);
  const s = useAppStore.getState();
  const o = s.orders.find((x) => x.id === id);
  useAppStore.setState({
    orders: s.orders.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)),
    activity: [{ id: uid(), at: Date.now(), kind: "cancel" as const, text: `#${o?.number} cancelled by student` }, ...s.activity].slice(0, 40),
  });
}

// TODO: replace with real API call
export async function acknowledgeReslot(id: string): Promise<void> {
  await wait(100);
  const s = useAppStore.getState();
  useAppStore.setState({ orders: s.orders.map((x) => (x.id === id && x.reslot ? { ...x, reslot: { ...x.reslot, acknowledged: true } } : x)) });
}

// TODO: replace with real API call
export async function markNotificationsRead(): Promise<void> {
  const s = useAppStore.getState();
  useAppStore.setState({ notifications: s.notifications.map((n) => ({ ...n, read: true })) });
}
