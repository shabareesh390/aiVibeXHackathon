import { create } from "zustand";
import type { ActivityEvent, AppNotification, MenuItem, Order, Station } from "@/types";
import { SEED_MENU, STATIONS } from "@/mock/menu";
import { makeSeed } from "@/mock/seed";

export interface AppData {
  menu: MenuItem[];
  stations: Station[];
  orders: Order[];
  batchProgress: Record<string, "started" | "done">;
  notifications: AppNotification[];
  activity: ActivityEvent[];
  nextNumber: number;
  seededAt: number;
}

export interface AppState extends AppData {
  ready: boolean;
}

const STORAGE_KEY = "dequeue.state.v1";
const CHANNEL = "dequeue-sync";

export const useAppStore = create<AppState>(() => ({
  ready: false,
  menu: [],
  stations: STATIONS,
  orders: [],
  batchProgress: {},
  notifications: [],
  activity: [],
  nextNumber: 100,
  seededAt: 0,
}));

function freshData(): AppData {
  const now = Date.now();
  const seed = makeSeed(now);
  return { menu: SEED_MENU, stations: STATIONS, batchProgress: {}, seededAt: now, ...seed };
}

const pickData = (s: AppState): AppData => ({
  menu: s.menu,
  stations: s.stations,
  orders: s.orders,
  batchProgress: s.batchProgress,
  notifications: s.notifications,
  activity: s.activity,
  nextNumber: s.nextNumber,
  seededAt: s.seededAt,
});

let started = false;
let applyingRemote = false;

/** Load state on the client and keep every open tab in sync. */
export function initAppStore() {
  if (started || typeof window === "undefined") return;
  started = true;
  let data: AppData | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (Date.now() - parsed.seededAt < 3 * 60 * 60_000) data = parsed;
    }
  } catch {
    data = null;
  }
  data ??= freshData();
  useAppStore.setState({ ...data, ready: true });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  const applyRemote = (d: AppData) => {
    applyingRemote = true;
    useAppStore.setState({ ...d, ready: true });
    applyingRemote = false;
  };
  channel?.addEventListener("message", (e) => applyRemote(e.data as AppData));
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue && !channel) applyRemote(JSON.parse(e.newValue));
  });

  useAppStore.subscribe((state) => {
    if (applyingRemote || !state.ready) return;
    const d = pickData(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    channel?.postMessage(d);
  });
}

export function resetDemoData() {
  useAppStore.setState({ ...freshData(), ready: true });
}

export const uid = () => Math.random().toString(36).slice(2, 10);
