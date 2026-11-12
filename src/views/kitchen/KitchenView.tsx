import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  ArrowLeft,
  Check,
  Flame,
  Package,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadBar } from "@/components/dq/LoadBadge";
import {
  markBatch,
  markCollected,
  replan,
  selectBatches,
  selectStationLoads,
} from "@/services/kitchenService";
import { useAppStore } from "@/store/appStore";
import { useAppReady, useNow } from "@/lib/hooks";
import { fmtClock, fmtTime, minutesBetween } from "@/lib/time";
import { WALK_IN_RESERVE } from "@/mock/menu";
import type { Batch, ReplanInput, StationId } from "@/types";
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

export function KitchenView() {
  const ready = useAppReady();
  const now = useNow(1000);
  const orders = useAppStore((s) => s.orders);
  const stations = useAppStore((s) => s.stations);
  useAppStore((s) => s.batchProgress);
  const batches = useMemo(() => (ready ? selectBatches(now) : []), [ready, now, orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const loads = useMemo(() => (ready ? selectStationLoads(now) : []), [ready, now, orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const readyOrders = orders
    .filter((o) => o.status === "ready")
    .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));

  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(0);
  const [dialog, setDialog] = useState<null | "late" | "down">(null);
  const [delay, setDelay] = useState(10);
  const [downStation, setDownStation] = useState<StationId>("tawa");
  const [downMin, setDownMin] = useState(15);
  const [working, setWorking] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  // Force dark theme for the kitchen tablet
  useEffect(() => {
    const el = document.documentElement;
    const had = el.classList.contains("dark");
    el.classList.add("dark");
    return () => {
      if (!had) el.classList.remove("dark");
    };
  }, []);

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
        <div className="flex items-center gap-3">
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
                        pickup ({b.orderIds.length} {b.orderIds.length === 1 ? "order" : "orders"})
                      </p>
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
    </div>
  );
}
