import { create } from "zustand";
import type {
  ActivityEvent,
  AppNotification,
  CanteenConfig,
  MenuItem,
  Order,
  StaffMember,
  Station,
} from "@/types";
import { SEED_MENU, STATIONS } from "@/mock/menu";
import { makeSeed } from "@/mock/seed";

export const DEFAULT_CONFIG: CanteenConfig = {
  slotIntervalMin: 15,
  maxOrdersPerSlot: 15,
  openingHour: 8,
  closingHour: 21,
  walkInReserve: 0.2,
  blockedSlots: [],
  upiId: "shabareesh390@okicici",
  upiName: "Shabareesh",
};

export const DEFAULT_STAFF: StaffMember[] = [
  { id: "staff-1", name: "Ramesh Kumar", role: "head_chef", station: "tawa", active: true },
  { id: "staff-2", name: "Suresh Patil", role: "station_cook", station: "fryer", active: true },
  { id: "staff-3", name: "Meena Devi", role: "station_cook", station: "beverage", active: true },
  { id: "staff-4", name: "Anand Verma", role: "packer", station: "packing", active: true },
];

export interface AppData {
  menu: MenuItem[];
  stations: Station[];
  orders: Order[];
  batchProgress: Record<string, "started" | "done">;
  notifications: AppNotification[];
  activity: ActivityEvent[];
  nextNumber: number;
  seededAt: number;
  config: CanteenConfig;
  staff: StaffMember[];
}

export interface AppState extends AppData {
  ready: boolean;
}

const STORAGE_KEY = "dequeue.state.v1";
const CHANNEL = "dequeue-sync";

export const useAppStore = create<AppState>()(() => ({
  ready: false,
  menu: [],
  stations: STATIONS,
  orders: [],
  batchProgress: {},
  notifications: [],
  activity: [],
  nextNumber: 100,
  seededAt: 0,
  config: DEFAULT_CONFIG,
  staff: DEFAULT_STAFF,
}));

function freshData(): AppData {
  const now = Date.now();
  const seed = makeSeed(now);
  return {
    menu: SEED_MENU,
    stations: STATIONS,
    batchProgress: {},
    seededAt: now,
    config: DEFAULT_CONFIG,
    staff: DEFAULT_STAFF,
    ...seed,
  };
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
  config: s.config ?? DEFAULT_CONFIG,
  staff: s.staff ?? DEFAULT_STAFF,
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
      if (Date.now() - parsed.seededAt < 3 * 60 * 60_000) {
        const resolvedConfig = parsed.config ?? DEFAULT_CONFIG;
        data = {
          ...parsed,
          config: {
            ...DEFAULT_CONFIG,
            ...resolvedConfig,
            upiId:
              !resolvedConfig.upiId || resolvedConfig.upiId === "canteen@upi"
                ? DEFAULT_CONFIG.upiId
                : resolvedConfig.upiId,
            upiName:
              !resolvedConfig.upiName || resolvedConfig.upiName === "Smart Canteen"
                ? DEFAULT_CONFIG.upiName
                : resolvedConfig.upiName,
          },
          staff: parsed.staff ?? DEFAULT_STAFF,
        };
      }
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

  useAppStore.subscribe((state: AppState) => {
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
