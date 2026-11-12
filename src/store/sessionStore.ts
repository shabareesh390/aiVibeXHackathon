import { create } from "zustand";
import type { CartItem, MockUser, PickupWindow, UnresolvedItem } from "@/types";

export interface SessionState {
  user: MockUser | null;
  text: string;
  cart: CartItem[];
  unresolved: UnresolvedItem[];
  window: PickupWindow;
  lastOrderId: string | null;
  setUser: (u: MockUser | null) => void;
  set: (p: Partial<Omit<SessionState, "set" | "setUser">>) => void;
}

const KEY = "dequeue.session.v1";

export const useSession = create<SessionState>()((set) => ({
  user: null,
  text: "",
  cart: [],
  unresolved: [],
  window: { asap: true },
  lastOrderId: null,
  setUser: (user) => set({ user }),
  set: (p) => set(p),
}));

let loaded = false;
export function initSession() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    const user = localStorage.getItem("dequeue.user");
    useSession.setState({ ...(raw ? JSON.parse(raw) : {}), user: user ? JSON.parse(user) : null });
  } catch {
    /* ignore */
  }
  useSession.subscribe((s: SessionState) => {
    const { user, text, cart, unresolved, window: w, lastOrderId } = s;
    sessionStorage.setItem(KEY, JSON.stringify({ text, cart, unresolved, window: w, lastOrderId }));
    if (user) localStorage.setItem("dequeue.user", JSON.stringify(user));
    else localStorage.removeItem("dequeue.user");
  });
}
