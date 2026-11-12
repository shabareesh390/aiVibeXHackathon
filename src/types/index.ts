export type StationId = "tawa" | "fryer" | "beverage" | "packing";
export type Load = "green" | "amber" | "red";
export type Role = "student" | "kitchen" | "manager";

export interface Station {
  id: StationId;
  name: string;
  /** Parallel units (tawas, fryer baskets, machines, packers). */
  parallel: number;
  /** Item units the station can finish in one 5-minute slot. */
  capacityPerSlot: number;
}

export type MenuCategory = "Dosa & Tiffin" | "Rice & Noodles" | "Snacks" | "Beverages";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  category: MenuCategory;
  station: StationId;
  durationMin: number;
  batchSize: number;
  /** Words people actually type or say, including Hinglish. */
  aliases: string[];
  /** Generic family word, used to ask "Which dosa?" */
  family?: string | undefined;
  modifiers: string[];
  description?: string | undefined;
  imageUrl?: string | undefined;
  inStock?: boolean | undefined;
  stockCount?: number | undefined;
}

export interface CartItem {
  itemId: string;
  qty: number;
  modifiers: string[];
}

export interface UnresolvedItem {
  id: string;
  phrase: string;
  qty: number;
  modifiers: string[];
  question: string;
  options: string[]; // menu item ids
}

export interface ParseResult {
  items: CartItem[];
  unresolved: UnresolvedItem[];
  notFound: string[];
  /** Latest pickup time mentioned in the text, epoch ms. */
  readyBy?: number | undefined;
}

export interface PickupWindow {
  asap: boolean;
  start?: number | undefined;
  end?: number | undefined;
}

export interface Slot {
  startTime: number;
  readyBy: number;
  load: Load;
  reason: string;
  capacityLeft: number;
  recommended?: boolean | undefined;
}

export type OrderStatus = "placed" | "scheduled" | "cooking" | "ready" | "collected" | "cancelled";
export type PaymentMethod = "upi" | "counter";

export interface ReslotNotice {
  from: number;
  to: number;
  reason: string;
  acknowledged: boolean;
}

export interface Order {
  id: string;
  number: number;
  studentName: string;
  mine: boolean;
  items: CartItem[];
  total: number;
  slotTime: number;
  status: OrderStatus;
  payment: PaymentMethod;
  createdAt: number;
  readyAt?: number | undefined;
  collectedAt?: number | undefined;
  shelf?: number | undefined;
  reslot?: ReslotNotice | undefined;
  cancelReason?: string | undefined;
  instructions?: string | undefined;
  estimatedPrepMin?: number | undefined;
}

export type BatchState = "upcoming" | "start-now" | "overdue" | "cooking" | "done";

export interface Batch {
  key: string;
  itemId: string;
  itemName: string;
  station: StationId;
  qty: number;
  startTime: number;
  pickupTime: number;
  orderIds: string[];
  state: BatchState;
}

export interface AppNotification {
  id: string;
  orderId?: string | undefined;
  title: string;
  body: string;
  at: number;
  read: boolean;
}

export interface ActivityEvent {
  id: string;
  at: number;
  kind: "order" | "replan" | "ready" | "collected" | "menu" | "cancel";
  text: string;
}

export type ReplanInput =
  { type: "delay"; minutes: number } | { type: "stationDown"; station: StationId; minutes: number };

export interface StationLoad {
  station: StationId;
  name: string;
  load: Load;
  ratio: number;
}

export interface Kpis {
  ordersToday: number;
  avgWaitMin: number | null;
  utilization: number;
  reslotted: number;
}

export interface HeatCell {
  station: StationId;
  slot: number;
  ratio: number;
  load: Load;
}

export interface DemandRow {
  itemId: string;
  itemName: string;
  bySlot: Record<number, number>;
  total: number;
}

export interface SimulationAssumptions {
  peakArrivalsPerMin: number;
  serviceSecPerOrder: number;
  counters: number;
  preOrderShare: number; // 0..1
}

export interface SimulationPoint {
  minute: number;
  fifo: number;
  dequeue: number;
}

export interface MockUser {
  name: string;
  role: Role;
}

export interface CanteenConfig {
  slotIntervalMin: number;
  maxOrdersPerSlot: number;
  openingHour: number;
  closingHour: number;
  walkInReserve: number;
  blockedSlots: number[];
  manualOccupiedSeats?: Record<number, number> | undefined;
  slotOverrides?: Record<number, "auto" | "free" | "busy" | "filled"> | undefined;
  upiId?: string | undefined;
  upiName?: string | undefined;
}

export interface StaffMember {
  id: string;
  name: string;
  role: "head_chef" | "station_cook" | "packer";
  station?: StationId | undefined;
  active: boolean;
}
