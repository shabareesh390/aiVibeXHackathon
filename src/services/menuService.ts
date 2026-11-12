import type { MenuItem, ParseResult } from "@/types";
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
  await wait(450);
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
