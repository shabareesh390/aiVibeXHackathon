import {
  Activity,
  Armchair,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Gauge,
  Minus,
  MessageSquareQuote,
  Plus,
  QrCode,
  Repeat,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  UserCheck,
  Users,
  Utensils,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadBadge } from "@/components/dq/LoadBadge";
import { OrderQRScannerModal } from "@/components/dq/OrderQRScannerModal";
import { getHeatmap, getKpis } from "@/services/analyticsService";
import { cancelOrder, updateOrderStatus } from "@/services/orderService";
import {
  addStaff,
  adjustManualSeats,
  deleteStaff,
  setSlotSeatStatus,
  toggleBlockSlot,
  updateCanteenConfig,
  updateStaff,
} from "@/services/menuService";
import { useAppStore } from "@/store/appStore";
import type { HeatCell, Kpis, Order, OrderStatus, StaffMember, StationId } from "@/types";
import { fmtTime, fmtTimeAmPm, inr } from "@/lib/time";
import { loadClasses } from "@/lib/load";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const ready = useAppStore((s) => s.ready);
  const orders = useAppStore((s) => s.orders);
  const stations = useAppStore((s) => s.stations);
  const menu = useAppStore((s) => s.menu);
  const activity = useAppStore((s) => s.activity);
  const config = useAppStore((s) => s.config);
  const staff = useAppStore((s) => s.staff ?? []);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [heat, setHeat] = useState<{ slots: number[]; cells: HeatCell[] } | null>(null);

  // Order management state
  const [searchOrder, setSearchOrder] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("Kitchen overload / student request");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Staff management state
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState<{
    name: string;
    role: "head_chef" | "station_cook" | "packer";
    station: StationId;
  }>({
    name: "",
    role: "station_cook",
    station: "tawa",
  });

  // Slot settings state
  const [slotInterval, setSlotInterval] = useState(config?.slotIntervalMin ?? 15);
  const [maxOrders, setMaxOrders] = useState(config?.maxOrdersPerSlot ?? 15);
  const [walkInReserve, setWalkInReserve] = useState(
    Math.round((config?.walkInReserve ?? 0.2) * 100),
  );
  const [upiId, setUpiId] = useState(config?.upiId ?? "shabareesh390@okicici");
  const [upiName, setUpiName] = useState(config?.upiName ?? "Shabareesh");

  useEffect(() => {
    if (config?.upiId) setUpiId(config.upiId);
    if (config?.upiName) setUpiName(config.upiName);
  }, [config?.upiId, config?.upiName]);

  useEffect(() => {
    if (!ready) return;
    getKpis().then(setKpis);
    getHeatmap().then(setHeat);
  }, [ready, orders]);

  // Total revenue calculated from real orders
  const totalRevenue = useMemo(() => {
    return orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0);
  }, [orders]);

  const cancelledCount = useMemo(() => {
    return orders.filter((o) => o.status === "cancelled").length;
  }, [orders]);

  // Hourly distribution for peak hours chart
  const hourlyData = useMemo(() => {
    const buckets: Record<number, number> = {};
    orders.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      buckets[hour] = (buckets[hour] ?? 0) + 1;
    });
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map((h) => ({
      hour: `${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`,
      orders: buckets[h] ?? 0,
    }));
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (orderFilter !== "all" && o.status !== orderFilter) return false;
        if (searchOrder.trim()) {
          const q = searchOrder.toLowerCase();
          const matchesNum = String(o.number).includes(q) || `#${o.number}`.includes(q);
          const matchesName = o.studentName.toLowerCase().includes(q);
          if (!matchesNum && !matchesName) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, orderFilter, searchOrder]);

  const handleSaveSlotConfig = async () => {
    await updateCanteenConfig({
      slotIntervalMin: Number(slotInterval),
      maxOrdersPerSlot: Number(maxOrders),
      walkInReserve: Number(walkInReserve) / 100,
    });
    toast.success("Pickup slot settings updated");
  };

  const handleSaveUpiConfig = async () => {
    if (!upiId.trim() || !upiId.includes("@")) {
      toast.error("Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm)");
      return;
    }
    await updateCanteenConfig({
      upiId: upiId.trim(),
      upiName: upiName.trim() || "Shabareesh",
    });
    toast.success("UPI payment settings saved successfully");
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name.trim()) {
      toast.error("Please enter a staff member name");
      return;
    }
    await addStaff({
      name: newStaff.name.trim(),
      role: newStaff.role,
      station: newStaff.station,
      active: true,
    });
    toast.success(`Staff member ${newStaff.name} added`);
    setAddStaffOpen(false);
    setNewStaff({ name: "", role: "station_cook", station: "tawa" });
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    await cancelOrder(cancelTarget.id, cancelReason);
    toast.success(`Order #${cancelTarget.number} cancelled`);
    setCancelTarget(null);
  };

  const cards = kpis
    ? [
        { label: "Orders today", value: String(kpis.ordersToday), icon: ShoppingBag },
        { label: "Total Revenue", value: inr(totalRevenue), icon: Utensils },
        {
          label: "Average wait at shelf",
          value: kpis.avgWaitMin === null ? "—" : `${kpis.avgWaitMin} min`,
          icon: Clock,
        },
        {
          label: "Slot utilization",
          value: `${Math.round(kpis.utilization * 100)}%`,
          icon: Gauge,
        },
        { label: "Cancelled orders", value: String(cancelledCount), icon: XCircle },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Canteen Administration</h1>
          <p className="text-sm text-muted-foreground">
            Manage live orders, pickup capacity, staff, and canteen operations.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid h-12 w-full grid-cols-4 rounded-2xl bg-muted p-1">
          <TabsTrigger value="overview" className="rounded-xl font-bold text-sm">
            Overview & KPIs
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl font-bold text-sm">
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="slots" className="rounded-xl font-bold text-sm">
            Seats & Slots
          </TabsTrigger>
          <TabsTrigger value="staff" className="rounded-xl font-bold text-sm">
            Kitchen Staff ({staff.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW & KPIS */}
        <TabsContent value="overview" className="space-y-6">
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-busy={!kpis}>
            {!kpis
              ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
              : cards.map((c) => (
                  <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-soft">
                    <c.icon className="size-5 text-primary" />
                    <p className="mt-3 font-display text-2xl font-bold tabular md:text-3xl">
                      {c.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                ))}
          </section>

          {/* Peak Ordering Hours Bar Chart */}
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-4 font-display text-xl font-semibold">Peak Ordering Hours</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" stroke="#888888" fontSize={12} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar dataKey="orders" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            {/* Slot Load Heatmap */}
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold">Slot load (Next 90 min)</h2>
                <div className="flex gap-2">
                  <LoadBadge load="green" />
                  <LoadBadge load="amber" />
                  <LoadBadge load="red" />
                </div>
              </div>
              {!heat ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-1">
                    <caption className="sr-only">Load per station per slot</caption>
                    <thead>
                      <tr>
                        <th className="w-20" />
                        {heat.slots.map((t, i) => (
                          <th
                            key={t}
                            scope="col"
                            className="text-[11px] font-medium text-muted-foreground tabular"
                          >
                            {i % 2 === 0 ? fmtTime(t) : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stations.map((s) => (
                        <tr key={s.id}>
                          <th scope="row" className="pr-2 text-left text-sm font-semibold">
                            {s.name}
                          </th>
                          {heat.cells
                            .filter((c) => c.station === s.id)
                            .map((c) => (
                              <td
                                key={c.slot}
                                title={`${s.name} ${fmtTime(c.slot)}: ${Math.round(c.ratio * 100)}%`}
                                className={cn(
                                  "h-10 min-w-8 rounded-md",
                                  c.ratio === 0 ? "bg-muted" : loadClasses[c.load].solid,
                                )}
                                style={{
                                  opacity: c.ratio === 0 ? 1 : 0.45 + Math.min(1, c.ratio) * 0.55,
                                }}
                              >
                                <span className="sr-only">{Math.round(c.ratio * 100)}%</span>
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent activity */}
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
                <Activity className="size-5 text-primary" />
                Recent activity
              </h2>
              {!ready ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No activity yet today.
                </p>
              ) : (
                <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {activity.slice(0, 15).map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          a.kind === "replan" || a.kind === "cancel"
                            ? "bg-load-busy"
                            : a.kind === "ready"
                              ? "bg-load-free"
                              : "bg-primary",
                        )}
                        aria-hidden
                      />
                      <div>
                        <p className="font-medium text-xs">{a.text}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(a.at, { addSuffix: true })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>

        {/* 2. ORDER MANAGEMENT */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Filter:</span>
              {(["all", "scheduled", "cooking", "ready", "collected", "cancelled"] as const).map(
                (st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={orderFilter === st ? "default" : "outline"}
                    className="h-8 rounded-full text-xs font-semibold uppercase"
                    onClick={() => setOrderFilter(st)}
                  >
                    {st}
                  </Button>
                ),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search token # or student name..."
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                  className="h-9 rounded-xl pl-9 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-9 rounded-xl font-bold gap-1.5 shadow-sm"
                onClick={() => setScannerOpen(true)}
              >
                <QrCode className="size-4" /> Scan QR Handover
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Token</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pickup Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-display text-base font-extrabold tabular">
                      #{o.number}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{o.studentName}</TableCell>
                    <TableCell className="text-xs max-w-xs">
                      <p className="truncate">
                        {o.items
                          .map(
                            (l) => `${l.qty}x ${menu.find((m) => m.id === l.itemId)?.name ?? "Item"}`,
                          )
                          .join(", ")}
                      </p>
                      {o.instructions && (
                        <div
                          className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-md px-1.5 py-0.5 w-fit max-w-[260px] truncate"
                          title={o.instructions}
                        >
                          <MessageSquareQuote className="size-3 shrink-0" />
                          <span className="truncate">Note: {o.instructions}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold tabular">{inr(o.total)}</TableCell>
                    <TableCell className="tabular text-xs">{fmtTimeAmPm(o.slotTime)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-bold uppercase",
                          o.status === "ready" && "bg-emerald-500/20 text-emerald-600",
                          o.status === "cooking" && "bg-orange-500/20 text-orange-600",
                          (o.status === "scheduled" || o.status === "placed") &&
                            "bg-blue-500/20 text-blue-600",
                          o.status === "collected" && "bg-muted text-muted-foreground",
                          o.status === "cancelled" && "bg-red-500/20 text-red-600",
                        )}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => setSelectedOrder(o)}
                      >
                        <Eye className="size-3.5" /> View
                      </Button>
                      {o.status !== "collected" && o.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelTarget(o)}
                        >
                          <XCircle className="size-3.5" /> Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No matching orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 3. PICKUP SLOT SETTINGS */}
        <TabsContent value="slots" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="font-display text-xl font-semibold">Slot Capacity & Intervals</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Pickup Interval</Label>
                  <Select
                    value={String(slotInterval)}
                    onValueChange={(v) => setSlotInterval(Number(v))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="10">Every 10 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Determines how frequently new pickup slots are opened.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Maximum Orders Per Slot</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxOrders}
                    onChange={(e) => setMaxOrders(Number(e.target.value))}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Concurrency threshold to avoid kitchen and counter congestion.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Walk-In Buffer Reserve ({walkInReserve}%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={walkInReserve}
                    onChange={(e) => setWalkInReserve(Number(e.target.value))}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Portion of kitchen station capacity held back for walk-in students.
                  </p>
                </div>

                <Button className="w-full rounded-xl font-bold" onClick={handleSaveSlotConfig}>
                  Save Capacity Settings
                </Button>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="font-display text-xl font-semibold">Slot Blocking & Hours</h2>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Operating Hours: 08:00 AM – 09:00 PM. Tap any slot below to temporarily block it
                  from student booking (e.g. during cleaning or rush).
                </p>
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                  {heat?.slots.map((s) => {
                    const isBlocked = config?.blockedSlots?.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleBlockSlot(s)}
                        className={cn(
                          "rounded-xl border py-2.5 text-center text-xs font-semibold tabular transition",
                          isBlocked
                            ? "bg-red-500/20 border-red-500 text-red-500 line-through"
                            : "bg-card hover:border-primary",
                        )}
                      >
                        {fmtTime(s)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Blocked slots are excluded from recommendation and cannot be booked by students.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">UPI & QR Payment</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Set your official UPI ID and Payee name for real-time QR code generation at checkout.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>UPI VPA Address</Label>
                  <Input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. shabareesh390@okicici"
                    className="font-mono rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Payments will be credited directly to this UPI address.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Payee Business / Name</Label>
                  <Input
                    type="text"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    placeholder="e.g. Shabareesh"
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Display name shown in GPay, PhonePe, Paytm apps.
                  </p>
                </div>

                <Button className="w-full rounded-xl font-bold" onClick={handleSaveUpiConfig}>
                  Save UPI Payment Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Seat Occupancy & Slot Controller */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <Armchair className="size-5 text-primary" /> Live Seat Occupancy & Capacity Status
                </h2>
                <p className="text-xs text-muted-foreground">
                  Mark which slots and tables are Free, Busy, or Filled. Add offline walk-in seats to
                  balance kitchen rush.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Slot Time</TableHead>
                    <TableHead className="w-64">Seat Occupancy</TableHead>
                    <TableHead className="w-28 text-center">Free Seats</TableHead>
                    <TableHead className="w-32 text-center">Status</TableHead>
                    <TableHead className="w-44">Manager Override</TableHead>
                    <TableHead className="w-40 text-center">Walk-In Seats</TableHead>
                    <TableHead className="text-right">Block</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heat?.slots.map((s) => {
                    const slotOrders = orders.filter(
                      (o) => o.status !== "cancelled" && o.slotTime === s,
                    );
                    const ordersCount = slotOrders.length;
                    const manualCount = config?.manualOccupiedSeats?.[s] ?? 0;
                    const totalOccupied = ordersCount + manualCount;
                    const maxCap = config?.maxOrdersPerSlot ?? 15;
                    const freeSeats = Math.max(0, maxCap - totalOccupied);
                    const isBlocked = config?.blockedSlots?.includes(s);
                    const override = config?.slotOverrides?.[s] ?? "auto";

                    let statusBadge: "free" | "busy" | "filled" | "blocked" = "free";
                    if (isBlocked) statusBadge = "blocked";
                    else if (override === "filled") statusBadge = "filled";
                    else if (override === "busy") statusBadge = "busy";
                    else if (override === "free") statusBadge = "free";
                    else if (totalOccupied >= maxCap) statusBadge = "filled";
                    else if (totalOccupied >= maxCap * 0.7) statusBadge = "busy";
                    else statusBadge = "free";

                    const pct = Math.min(100, Math.round((totalOccupied / maxCap) * 100));

                    return (
                      <TableRow key={s}>
                        <TableCell className="font-bold tabular text-sm">
                          {fmtTimeAmPm(s)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold tabular">
                              <span>
                                {totalOccupied} / {maxCap} seats filled
                              </span>
                              <span className="text-muted-foreground font-normal">
                                ({ordersCount} orders + {manualCount} walk-in)
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300",
                                  pct >= 90
                                    ? "bg-destructive"
                                    : pct >= 65
                                      ? "bg-amber-500"
                                      : "bg-load-free",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold tabular text-sm">
                          {statusBadge === "blocked" || statusBadge === "filled" ? (
                            <span className="text-destructive">0 free</span>
                          ) : (
                            <span className={freeSeats <= 3 ? "text-amber-500" : "text-load-free"}>
                              {freeSeats} free
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {statusBadge === "blocked" ? (
                            <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive">
                              Blocked
                            </span>
                          ) : statusBadge === "filled" ? (
                            <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive">
                              Filled
                            </span>
                          ) : statusBadge === "busy" ? (
                            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                              Busy
                            </span>
                          ) : (
                            <span className="rounded-full bg-load-free-soft px-2.5 py-1 text-xs font-bold text-load-free">
                              Free
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={override}
                            onValueChange={(val: "auto" | "free" | "busy" | "filled") => {
                              setSlotSeatStatus(s, val);
                              toast.success(
                                `Slot at ${fmtTime(s)} set to ${val === "auto" ? "System Auto" : val.toUpperCase()}`,
                              );
                            }}
                          >
                            <SelectTrigger className="h-8 rounded-lg text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto (System)</SelectItem>
                              <SelectItem value="free">Mark Free (Open)</SelectItem>
                              <SelectItem value="busy">Mark Busy (Rush)</SelectItem>
                              <SelectItem value="filled">Mark Filled (Full)</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={manualCount <= 0}
                              onClick={() => adjustManualSeats(s, -1)}
                              className="size-7 rounded-lg"
                              title="Decrease walk-in occupants"
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-6 text-center text-xs font-bold tabular">
                              {manualCount}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => adjustManualSeats(s, 1)}
                              className="size-7 rounded-lg"
                              title="Add walk-in occupants"
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant={isBlocked ? "destructive" : "ghost"}
                            size="sm"
                            onClick={() => {
                              toggleBlockSlot(s);
                              toast.info(
                                isBlocked
                                  ? `Unblocked slot at ${fmtTime(s)}`
                                  : `Blocked slot at ${fmtTime(s)}`,
                              );
                            }}
                            className="h-8 rounded-lg text-xs font-semibold"
                          >
                            {isBlocked ? "Unblock" : "Block"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* 4. STAFF MANAGEMENT */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Kitchen Personnel</h2>
              <p className="text-xs text-muted-foreground">
                Assign cooks and packers to specific kitchen stations.
              </p>
            </div>
            <Button className="rounded-xl" onClick={() => setAddStaffOpen(true)}>
              <Plus className="size-4" /> Add Staff Member
            </Button>
          </div>

          <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Station</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell className="font-bold text-sm">{st.name}</TableCell>
                    <TableCell className="text-xs capitalize font-medium">
                      {st.role.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={st.station ?? "tawa"}
                        onValueChange={(val) => updateStaff(st.id, { station: val as StationId })}
                      >
                        <SelectTrigger className="h-8 w-32 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stations.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={st.active}
                          onCheckedChange={(act) => updateStaff(st.id, { active: act })}
                        />
                        <span className="text-xs font-semibold">
                          {st.active ? "Active" : "Off Duty"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteStaff(st.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Order #{selectedOrder?.number} Details
            </DialogTitle>
            <DialogDescription>
              Placed by {selectedOrder?.studentName} at{" "}
              {selectedOrder && fmtTime(selectedOrder.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="space-y-2 border-b pb-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Status:</span>
                  <span className="uppercase text-primary">{selectedOrder.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pickup Slot:</span>
                  <span className="font-bold tabular">{fmtTimeAmPm(selectedOrder.slotTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="uppercase">{selectedOrder.payment}</span>
                </div>
                {selectedOrder.shelf && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Shelf:</span>
                    <span>#{selectedOrder.shelf}</span>
                  </div>
                )}
                {selectedOrder.cancelReason && (
                  <div className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
                    Cancellation reason: {selectedOrder.cancelReason}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ordered Items
                </p>
                <ul className="space-y-1.5 text-sm">
                  {selectedOrder.items.map((it, idx) => (
                    <li key={idx} className="flex justify-between text-xs">
                      <span>
                        {it.qty} × {menu.find((m) => m.id === it.itemId)?.name ?? "Item"}
                        {it.modifiers.length > 0 && ` (${it.modifiers.join(", ")})`}
                      </span>
                      <span className="font-semibold tabular">
                        {inr((menu.find((m) => m.id === it.itemId)?.price ?? 0) * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedOrder.instructions && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/15 p-3 text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1">
                    <MessageSquareQuote className="size-4" /> Special Student Instructions:
                  </p>
                  <p className="font-semibold italic text-foreground bg-background/60 rounded-lg p-2 border border-border">
                    "{selectedOrder.instructions}"
                  </p>
                </div>
              )}

              <div className="flex justify-between border-t pt-3 text-base font-bold">
                <span>Total</span>
                <span>{inr(selectedOrder.total)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Cancel Order #{cancelTarget?.number}?
            </DialogTitle>
            <DialogDescription>
              Enter the cancellation reason. The student will be notified and slot capacity
              released.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-rs">Reason</Label>
            <Input
              id="cancel-rs"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setCancelTarget(null)}>
              Dismiss
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleConfirmCancel}>
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStaffSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Staff Name</Label>
              <Input
                id="st-name"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                placeholder="Chef Rajesh"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={newStaff.role}
                onValueChange={(val) =>
                  setNewStaff({
                    ...newStaff,
                    role: val as "head_chef" | "station_cook" | "packer",
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="head_chef">Head Chef</SelectItem>
                  <SelectItem value="station_cook">Station Cook</SelectItem>
                  <SelectItem value="packer">Packer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Station</Label>
              <Select
                value={newStaff.station}
                onValueChange={(val) => setNewStaff({ ...newStaff, station: val as StationId })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl font-bold">
                Save Staff
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <OrderQRScannerModal open={scannerOpen} onOpenChange={setScannerOpen} />
    </div>
  );
}
