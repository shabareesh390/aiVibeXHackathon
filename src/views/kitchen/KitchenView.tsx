import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  LayoutGrid,
  ListOrdered,
  MessageSquareQuote,
  Package,
  QrCode,
  Search,
  Timer,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrderQRScannerModal } from "@/components/dq/OrderQRScannerModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadBar } from "@/components/dq/LoadBadge";
import {
  markBatch,
  markCollected,
  replan,
  selectBatches,
  selectStationLoads,
} from "@/services/kitchenService";
import { cancelOrder, updateOrderStatus } from "@/services/orderService";
import { useAppStore } from "@/store/appStore";
import { useAppReady, useNow } from "@/lib/hooks";
import { fmtClock, fmtTime, minutesBetween } from "@/lib/time";
import { WALK_IN_RESERVE } from "@/mock/menu";
import type { Batch, CartItem, Order, ReplanInput, StationId } from "@/types";
import { cn } from "@/lib/utils";

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = 880;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {
    /* audio blocked */
  }
}

const stateStyle: Record<Batch["state"], string> = {
  upcoming: "border-border bg-card",
  "start-now": "border-load-busy bg-load-busy-soft animate-start-pulse",
  overdue: "border-load-full bg-load-full-soft",
  cooking: "border-primary/60 bg-accent",
  done: "",
};
const stateLabel: Record<Batch["state"], string> = {
  upcoming: "Upcoming",
  "start-now": "Start now",
  overdue: "Overdue",
  cooking: "Cooking",
  done: "Done",
};

interface KitchenOrderCardProps {
  order: Order;
  stage: "new" | "cooking" | "ready" | "collected";
  now: number;
  menu: ReturnType<typeof useAppStore.getState>["menu"];
  onStartPrep: () => void;
  onMarkReady: () => void;
  onMarkCollected: () => void;
  onCancel: () => void;
}

function KitchenOrderCard({
  order,
  stage,
  now,
  menu,
  onStartPrep,
  onMarkReady,
  onMarkCollected,
  onCancel,
}: KitchenOrderCardProps) {
  const isDelayed = now > order.slotTime + 3 * 60_000 && stage !== "ready" && stage !== "collected";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-soft transition bg-card",
        isDelayed && "border-load-full bg-load-full-soft/20 ring-1 ring-load-full/30",
        stage === "ready" && "border-load-free bg-load-free-soft/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-display text-2xl font-extrabold tabular">#{order.number}</span>
          <p className="font-semibold text-foreground text-sm">{order.studentName}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Pickup</span>
          <p className="font-bold tabular text-sm">{fmtTime(order.slotTime)}</p>
          <span className="text-[10px] font-semibold text-primary">⚡ &lt;15m target</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm border-t pt-2">
        {order.items.map((item: CartItem, idx: number) => {
          const itemDef = menu.find((m) => m.id === item.itemId);
          return (
            <li key={idx} className="flex justify-between text-xs">
              <span className="font-medium">
                {item.qty} × {itemDef?.name ?? "Item"}
              </span>
              {item.modifiers.length > 0 && (
                <span className="text-muted-foreground text-[11px]">
                  ({item.modifiers.join(", ")})
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {order.instructions && (
        <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 p-2 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <MessageSquareQuote className="size-3.5" />
            Special Instructions:
          </p>
          <p className="font-semibold italic mt-0.5 text-foreground">
            "{order.instructions}"
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Prep: ~{order.estimatedPrepMin ?? 5}m</span>
        <span>Ordered: {fmtTime(order.createdAt)}</span>
      </div>

      {isDelayed && (
        <p className="mt-1.5 text-xs font-bold text-load-full">⚠️ Delayed past pickup slot!</p>
      )}

      {stage === "ready" && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-load-free/20 px-3 py-2 text-load-foreground">
          <span className="text-xs font-bold uppercase">Shelf</span>
          <span className="font-display text-2xl font-extrabold">{order.shelf ?? 1}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {stage === "new" && (
          <>
            <Button size="sm" className="flex-1 rounded-xl font-bold" onClick={onStartPrep}>
              <Flame className="size-3.5" /> Start Prep
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl text-muted-foreground hover:text-destructive"
              onClick={onCancel}
              title="Cancel order"
            >
              <XCircle className="size-4" />
            </Button>
          </>
        )}
        {stage === "cooking" && (
          <>
            <Button
              size="sm"
              className="flex-1 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onMarkReady}
            >
              <Check className="size-3.5" /> Mark Ready
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl text-muted-foreground hover:text-destructive"
              onClick={onCancel}
              title="Cancel order"
            >
              <XCircle className="size-4" />
            </Button>
          </>
        )}
        {stage === "ready" && (
          <Button size="sm" className="w-full rounded-xl font-bold" onClick={onMarkCollected}>
            <CheckCircle2 className="size-3.5" /> Mark Collected
          </Button>
        )}
        {stage === "collected" && (
          <span className="w-full text-center text-xs text-muted-foreground py-1 font-medium">
            Collected at {order.collectedAt ? fmtTime(order.collectedAt) : "shelf"}
          </span>
        )}
      </div>
    </div>
  );
}

export function KitchenView() {
  const ready = useAppReady();
  const now = useNow(1000);
  const orders = useAppStore((s) => s.orders);
  const stations = useAppStore((s) => s.stations);
  const menu = useAppStore((s) => s.menu);
  useAppStore((s) => s.batchProgress);
  const batches = useMemo(() => (ready ? selectBatches(now) : []), [ready, now, orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const loads = useMemo(() => (ready ? selectStationLoads(now) : []), [ready, now, orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const readyOrders = orders
    .filter((o) => o.status === "ready")
    .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));

  const [viewMode, setViewMode] = useState<"pipeline" | "batches">("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "cooking" | "ready" | "collected"
  >("all");
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("Kitchen overload / item unavailable");
  const [scannerOpen, setScannerOpen] = useState(false);

  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(0);
  const [dialog, setDialog] = useState<null | "late" | "down">(null);
  const [delay, setDelay] = useState(10);
  const [downStation, setDownStation] = useState<StationId>("tawa");
  const [downMin, setDownMin] = useState(15);
  const [working, setWorking] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const lastOrderCount = useRef(orders.length);

  // Force dark theme for the kitchen tablet
  useEffect(() => {
    const el = document.documentElement;
    const had = el.classList.contains("dark");
    el.classList.add("dark");
    return () => {
      if (!had) el.classList.remove("dark");
    };
  }, []);

  // Alert on incoming new orders
  useEffect(() => {
    if (orders.length > lastOrderCount.current) {
      setFlash((f) => f + 1);
      if (!muted) beep();
      toast.info("New order received in kitchen!");
    }
    lastOrderCount.current = orders.length;
  }, [orders.length, muted]);

  useEffect(() => {
    const startNow = batches.filter((b) => b.state === "start-now").map((b) => b.key);
    if (seen.current === null) {
      seen.current = new Set(startNow);
      return;
    }
    const fresh = startNow.filter((k) => !seen.current!.has(k));
    startNow.forEach((k) => seen.current!.add(k));
    if (fresh.length) {
      setFlash((f) => f + 1);
      if (!muted) beep();
    }
  }, [batches, muted]);

  const doReplan = async (input: ReplanInput) => {
    setWorking(true);
    const affected = await replan(input);
    setWorking(false);
    setDialog(null);
    toast.success(`${affected.length} orders moved, students notified`);
  };

  const handleCancelOrder = async () => {
    if (!cancelDialogOrder) return;
    await cancelOrder(cancelDialogOrder.id, cancelReasonInput);
    toast.error(`Order #${cancelDialogOrder.number} cancelled`);
    setCancelDialogOrder(null);
  };

  const newOrders = useMemo(
    () => orders.filter((o) => o.status === "scheduled" || o.status === "placed"),
    [orders],
  );
  const cookingOrders = useMemo(() => orders.filter((o) => o.status === "cooking"), [orders]);
  const completedOrders = useMemo(() => orders.filter((o) => o.status === "collected"), [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesToken = String(o.number).includes(q) || `#${o.number}`.includes(q);
        const matchesStudent = o.studentName.toLowerCase().includes(q);
        if (!matchesToken && !matchesStudent) return false;
      }
      if (statusFilter === "new") return o.status === "scheduled" || o.status === "placed";
      if (statusFilter === "cooking") return o.status === "cooking";
      if (statusFilter === "ready") return o.status === "ready";
      if (statusFilter === "collected") return o.status === "collected";
      return o.status !== "cancelled";
    });
  }, [orders, searchQuery, statusFilter]);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {flash > 0 && (
        <div
          key={flash}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 animate-edge-flash"
        />
      )}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b bg-background/95 px-5 py-4 backdrop-blur">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-14"
          aria-label="Back to role selection"
        >
          <Link to="/">
            <ArrowLeft className="size-7!" />
          </Link>
        </Button>
        <p className="font-display text-5xl font-extrabold tabular" aria-label="Current time">
          {fmtClock(now)}
        </p>
        <ul className="flex flex-1 flex-wrap gap-3" aria-label="Station load">
          {ready
            ? loads.map((l) => (
                <li key={l.station} className="min-w-36 rounded-2xl bg-card px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-lg font-bold">{l.name}</span>
                    <span className="text-sm font-semibold tabular text-muted-foreground">
                      {Math.round(l.ratio * 100)}%
                    </span>
                  </div>
                  <LoadBar ratio={l.ratio} load={l.load} className="mt-1.5 h-3" />
                </li>
              ))
            : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-36 rounded-2xl" />)}
        </ul>
        <div className="flex items-center gap-1.5 rounded-2xl border bg-card p-1">
          <Button
            size="sm"
            variant={viewMode === "pipeline" ? "default" : "ghost"}
            className="rounded-xl px-4 font-bold"
            onClick={() => setViewMode("pipeline")}
          >
            <LayoutGrid className="size-4" />4 Stages
          </Button>
          <Button
            size="sm"
            variant={viewMode === "batches" ? "default" : "ghost"}
            className="rounded-xl px-4 font-bold"
            onClick={() => setViewMode("batches")}
          >
            <ListOrdered className="size-4" />
            Batches
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="h-16 rounded-2xl px-5 text-base sm:text-lg font-bold gap-2 shadow-md bg-primary text-primary-foreground hover:opacity-95"
            onClick={() => setScannerOpen(true)}
          >
            <QrCode className="size-6!" />
            Scan QR Handover
          </Button>
          <Button
            variant="outline"
            className="h-16 rounded-2xl px-6 text-lg font-bold"
            onClick={() => setDialog("late")}
          >
            <Timer className="size-6!" />
            Running late
          </Button>
          <Button
            variant="destructive"
            className="h-16 rounded-2xl px-6 text-lg font-bold"
            onClick={() => setDialog("down")}
          >
            <AlertOctagon className="size-6!" />
            Station down
          </Button>
          <Button
            variant="secondary"
            className="size-16 rounded-2xl"
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
            aria-label={muted ? "Unmute alerts" : "Mute alerts"}
          >
            {muted ? <VolumeX className="size-7!" /> : <Volume2 className="size-7!" />}
          </Button>
        </div>
      </header>

      {viewMode === "pipeline" ? (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Filter:</span>
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setStatusFilter("all")}
              >
                All Active ({orders.filter((o) => o.status !== "cancelled").length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "new" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setStatusFilter("new")}
              >
                New ({newOrders.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "cooking" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setStatusFilter("cooking")}
              >
                Preparing ({cookingOrders.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "ready" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setStatusFilter("ready")}
              >
                Ready ({readyOrders.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "collected" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setStatusFilter("collected")}
              >
                Completed ({completedOrders.length})
              </Button>
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search token # or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {/* 1. NEW ORDERS */}
            <div className="flex flex-col rounded-3xl border bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-blue-500" />
                  <h2 className="font-display text-lg font-bold">1. NEW ORDERS</h2>
                </div>
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-400">
                  {newOrders.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1">
                {newOrders.map((o) => (
                  <KitchenOrderCard
                    key={o.id}
                    order={o}
                    stage="new"
                    now={now}
                    menu={menu}
                    onStartPrep={() => updateOrderStatus(o.id, "cooking")}
                    onMarkReady={() => updateOrderStatus(o.id, "ready")}
                    onMarkCollected={() => markCollected(o.id)}
                    onCancel={() => setCancelDialogOrder(o)}
                  />
                ))}
                {newOrders.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No new orders</p>
                )}
              </div>
            </div>

            {/* 2. PREPARING */}
            <div className="flex flex-col rounded-3xl border bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-orange-500" />
                  <h2 className="font-display text-lg font-bold">2. PREPARING</h2>
                </div>
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-bold text-orange-400">
                  {cookingOrders.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1">
                {cookingOrders.map((o) => (
                  <KitchenOrderCard
                    key={o.id}
                    order={o}
                    stage="cooking"
                    now={now}
                    menu={menu}
                    onStartPrep={() => updateOrderStatus(o.id, "cooking")}
                    onMarkReady={() => updateOrderStatus(o.id, "ready")}
                    onMarkCollected={() => markCollected(o.id)}
                    onCancel={() => setCancelDialogOrder(o)}
                  />
                ))}
                {cookingOrders.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No orders cooking
                  </p>
                )}
              </div>
            </div>

            {/* 3. READY FOR PICKUP */}
            <div className="flex flex-col rounded-3xl border bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-emerald-500" />
                  <h2 className="font-display text-lg font-bold">3. READY FOR PICKUP</h2>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  {readyOrders.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1">
                {readyOrders.map((o) => (
                  <KitchenOrderCard
                    key={o.id}
                    order={o}
                    stage="ready"
                    now={now}
                    menu={menu}
                    onStartPrep={() => updateOrderStatus(o.id, "cooking")}
                    onMarkReady={() => updateOrderStatus(o.id, "ready")}
                    onMarkCollected={() => markCollected(o.id)}
                    onCancel={() => setCancelDialogOrder(o)}
                  />
                ))}
                {readyOrders.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No orders waiting on shelf
                  </p>
                )}
              </div>
            </div>

            {/* 4. COMPLETED / COLLECTED */}
            <div className="flex flex-col rounded-3xl border bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                  <h2 className="font-display text-lg font-bold">4. COMPLETED</h2>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  {completedOrders.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1">
                {completedOrders.slice(0, 15).map((o) => (
                  <KitchenOrderCard
                    key={o.id}
                    order={o}
                    stage="collected"
                    now={now}
                    menu={menu}
                    onStartPrep={() => updateOrderStatus(o.id, "cooking")}
                    onMarkReady={() => updateOrderStatus(o.id, "ready")}
                    onMarkCollected={() => markCollected(o.id)}
                    onCancel={() => setCancelDialogOrder(o)}
                  />
                ))}
                {completedOrders.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No collected orders yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_400px]">
          <section aria-label="Cooking batches">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="font-display text-3xl font-bold">Cooking plan</h1>
              <span className="rounded-full bg-secondary px-4 py-1.5 text-base font-semibold">
                Walk-in reserve: {Math.round(WALK_IN_RESERVE * 100)}%
              </span>
            </div>
            {!ready ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-40 rounded-3xl" />
                ))}
              </div>
            ) : batches.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed p-16 text-center text-2xl text-muted-foreground">
                All caught up. No batches queued.
              </div>
            ) : (
              <ol className="space-y-4">
                {batches.slice(0, 14).map((b) => (
                  <li key={b.key} className={cn("rounded-3xl border-4 p-5", stateStyle[b.state])}>
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-3 text-lg font-bold uppercase tracking-wide">
                          <span
                            className={cn(
                              b.state === "overdue" && "text-load-full",
                              b.state === "start-now" && "text-load-busy",
                            )}
                          >
                            {stateLabel[b.state]}
                          </span>
                          <span className="text-muted-foreground">
                            · {stations.find((s) => s.id === b.station)?.name}
                          </span>
                        </p>
                        <p className="mt-1 text-4xl font-extrabold leading-tight">
                          <span className="tabular">START {fmtTime(b.startTime)}</span>, {b.qty} ×{" "}
                          {b.itemName}
                        </p>
                        <p className="mt-1 text-xl text-muted-foreground">
                          for the{" "}
                          <span className="font-bold text-foreground tabular">
                            {fmtTime(b.pickupTime)}
                          </span>{" "}
                          pickup ({b.orderIds.length} {b.orderIds.length === 1 ? "order" : "orders"}
                          )
                        </p>
                        {(() => {
                          const batchInstructions = b.orderIds
                            .map((id) => orders.find((o) => o.id === id))
                            .filter((o) => !!o?.instructions)
                            .map((o) => ({ number: o!.number, text: o!.instructions! }));
                          if (!batchInstructions.length) return null;
                          return (
                            <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                              <p className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                <MessageSquareQuote className="size-3.5" /> Special Instructions:
                              </p>
                              <ul className="mt-1 space-y-1">
                                {batchInstructions.map((ins, idx) => (
                                  <li key={idx} className="font-semibold italic text-foreground">
                                    • Order #{ins.number}: "{ins.text}"
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          disabled={b.state === "cooking"}
                          className="h-20 min-w-36 rounded-2xl text-2xl font-bold"
                          onClick={() => markBatch(b, "started")}
                        >
                          <Flame className="size-7!" />
                          Started
                        </Button>
                        <Button
                          className="h-20 min-w-36 rounded-2xl text-2xl font-bold"
                          onClick={() => markBatch(b, "done")}
                        >
                          <Check className="size-7!" />
                          Done
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside
            aria-label="Ready for pickup"
            className="rounded-3xl bg-card p-5 lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto"
          >
            <h2 className="mb-4 flex items-center gap-2 font-display text-3xl font-bold">
              <Package className="size-8" />
              Ready for pickup
            </h2>
            {readyOrders.length === 0 ? (
              <p className="py-10 text-center text-xl text-muted-foreground">Shelves are empty.</p>
            ) : (
              <ul className="space-y-3">
                {readyOrders.map((o) => {
                  const held = minutesBetween(o.readyAt ?? now, now);
                  const tooLong = held >= 10;
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "rounded-2xl border-4 p-4",
                        tooLong
                          ? "border-load-full bg-load-full-soft"
                          : "border-transparent bg-secondary",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-3xl font-extrabold tabular">#{o.number}</p>
                          <p className="text-xl">{o.studentName.split(" ")[0]}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold uppercase text-muted-foreground">
                            Shelf
                          </p>
                          <p className="text-5xl font-extrabold tabular">{o.shelf}</p>
                        </div>
                      </div>
                      {o.instructions && (
                        <p className="mt-1.5 text-xs font-semibold italic text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-lg px-2 py-1">
                          Note: {o.instructions}
                        </p>
                      )}
                      {tooLong && (
                        <p className="mt-2 text-lg font-bold text-load-full">
                          Held {held} min — call the student
                        </p>
                      )}
                      <Button
                        className="mt-3 h-16 w-full rounded-2xl text-2xl font-bold"
                        onClick={() => {
                          markCollected(o.id);
                          toast.success(`#${o.number} collected`);
                        }}
                      >
                        Collected
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}

      {/* Cancel Order with reason dialog */}
      <Dialog open={!!cancelDialogOrder} onOpenChange={(o) => !o && setCancelDialogOrder(null)}>
        <DialogContent className="dark max-w-md rounded-3xl bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Cancel Order #{cancelDialogOrder?.number}?
            </DialogTitle>
            <DialogDescription>
              State the reason for cancellation. The student will be notified immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-semibold">
              Student: {cancelDialogOrder?.studentName} · Token #{cancelDialogOrder?.number}
            </p>
            <div className="space-y-1.5">
              <label htmlFor="cancel-reason" className="text-xs text-muted-foreground">
                Cancellation Reason
              </label>
              <Input
                id="cancel-reason"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Item out of stock, kitchen breakdown"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setCancelDialogOrder(null)}
            >
              Keep Order
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleCancelOrder}>
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "late"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="dark max-w-lg rounded-3xl bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">How far behind?</DialogTitle>
            <DialogDescription className="text-lg">
              All upcoming pickups move back and students get notified.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {[5, 10, 15].map((m) => (
              <Button
                key={m}
                variant={delay === m ? "default" : "secondary"}
                className="h-20 rounded-2xl text-3xl font-extrabold"
                onClick={() => setDelay(m)}
                aria-pressed={delay === m}
              >
                +{m}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={working}
              className="h-16 w-full rounded-2xl text-xl font-bold"
              onClick={() => doReplan({ type: "delay", minutes: delay })}
            >
              Re-plan +{delay} min
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "down"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="dark max-w-lg rounded-3xl bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Which station is down?</DialogTitle>
            <DialogDescription className="text-lg">
              Orders that need it get moved past the outage.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {stations.map((s) => (
              <Button
                key={s.id}
                variant={downStation === s.id ? "default" : "secondary"}
                className="h-16 rounded-2xl text-xl font-bold"
                onClick={() => setDownStation(s.id)}
                aria-pressed={downStation === s.id}
              >
                {s.name}
              </Button>
            ))}
          </div>
          <p className="text-lg font-semibold">For how long?</p>
          <div className="grid grid-cols-3 gap-3">
            {[10, 15, 30].map((m) => (
              <Button
                key={m}
                variant={downMin === m ? "default" : "secondary"}
                className="h-16 rounded-2xl text-2xl font-bold"
                onClick={() => setDownMin(m)}
                aria-pressed={downMin === m}
              >
                {m} min
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={working}
              variant="destructive"
              className="h-16 w-full rounded-2xl text-xl font-bold"
              onClick={() =>
                doReplan({ type: "stationDown", station: downStation, minutes: downMin })
              }
            >
              Re-plan around outage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderQRScannerModal open={scannerOpen} onOpenChange={setScannerOpen} />
    </div>
  );
}
