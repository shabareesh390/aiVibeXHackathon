import type { CanteenConfig, MenuItem, ParseResult, StaffMember } from "@/types";
import { useAppStore, uid } from "@/store/appStore";
import { parseOrderText } from "./parser";
import { wait } from "./util";

// TODO: replace with real API call
export async function getMenu(): Promise<MenuItem[]> {
  await wait(150);
  return useAppStore.getState().menu;
}

// TODO: replace with real API call (e.g. an LLM-backed order parser)
export async function parseOrder(text: string): Promise<ParseResult> {
  await wait(300);
  return parseOrderText(text, useAppStore.getState().menu);
}

// TODO: replace with real API call
export async function updateItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem> {
  await wait(120);
  const s = useAppStore.getState();
  const menu = s.menu.map((m) => (m.id === id ? { ...m, ...patch } : m));
  useAppStore.setState({
    menu,
    activity: [
      {
        id: uid(),
        at: Date.now(),
        kind: "menu" as const,
        text: `Menu updated: ${menu.find((m) => m.id === id)?.name}`,
      },
      ...s.activity,
    ].slice(0, 40),
  });
  return menu.find((m) => m.id === id)!;
}

// TODO: replace with real API call
export async function deleteItem(id: string): Promise<void> {
  await wait(120);
  const s = useAppStore.getState();
  const target = s.menu.find((m) => m.id === id);
  useAppStore.setState({
    menu: s.menu.filter((m) => m.id !== id),
    activity: [
      {
        id: uid(),
        at: Date.now(),
        kind: "menu" as const,
        text: `Item removed from menu: ${target?.name ?? id}`,
      },
      ...s.activity,
    ].slice(0, 40),
  });
}

// TODO: replace with real API call
export async function addItem(item: Omit<MenuItem, "id">): Promise<MenuItem> {
  await wait(200);
  const created: MenuItem = {
    ...item,
    id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${uid().slice(0, 4)}`,
  };
  const s = useAppStore.getState();
  useAppStore.setState({
    menu: [...s.menu, created],
    activity: [
      { id: uid(), at: Date.now(), kind: "menu" as const, text: `Added to menu: ${created.name}` },
      ...s.activity,
    ].slice(0, 40),
  });
  return created;
}

// TODO: replace with real API call
export async function updateCanteenConfig(patch: Partial<CanteenConfig>): Promise<void> {
  await wait(100);
  const s = useAppStore.getState();
  useAppStore.setState({
    config: { ...s.config, ...patch },
  });
}

// TODO: replace with real API call
export async function toggleBlockSlot(slotTime: number): Promise<void> {
  const s = useAppStore.getState();
  const current = s.config.blockedSlots ?? [];
  const has = current.includes(slotTime);
  const next = has ? current.filter((t) => t !== slotTime) : [...current, slotTime];
  useAppStore.setState({
    config: { ...s.config, blockedSlots: next },
  });
}

// TODO: replace with real API call
export async function addStaff(staff: Omit<StaffMember, "id">): Promise<StaffMember> {
  await wait(100);
  const created: StaffMember = { ...staff, id: `staff-${uid().slice(0, 4)}` };
  const s = useAppStore.getState();
  useAppStore.setState({
    staff: [...(s.staff ?? []), created],
  });
  return created;
}

// TODO: replace with real API call
export async function updateStaff(id: string, patch: Partial<StaffMember>): Promise<void> {
  await wait(100);
  const s = useAppStore.getState();
  useAppStore.setState({
    staff: (s.staff ?? []).map((st) => (st.id === id ? { ...st, ...patch } : st)),
  });
}

// TODO: replace with real API call
export async function deleteStaff(id: string): Promise<void> {
  await wait(100);
  const s = useAppStore.getState();
  useAppStore.setState({
    staff: (s.staff ?? []).filter((st) => st.id !== id),
  });
}
