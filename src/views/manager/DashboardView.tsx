import { Activity, Clock, Gauge, Repeat, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadBadge } from "@/components/dq/LoadBadge";
import { getHeatmap, getKpis } from "@/services/analyticsService";
import { useAppStore } from "@/store/appStore";
import type { HeatCell, Kpis } from "@/types";
import { fmtTime } from "@/lib/time";
import { loadClasses } from "@/lib/load";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const ready = useAppStore((s) => s.ready);
  const orders = useAppStore((s) => s.orders);
  const stations = useAppStore((s) => s.stations);
  const activity = useAppStore((s) => s.activity);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [heat, setHeat] = useState<{ slots: number[]; cells: HeatCell[] } | null>(null);

  useEffect(() => {
    if (!ready) return;
    getKpis().then(setKpis);
    getHeatmap().then(setHeat);
  }, [ready, orders]);

  const cards = kpis
    ? [
        { label: "Orders today", value: String(kpis.ordersToday), icon: ShoppingBag },
        {
          label: "Average wait at shelf",
          value: kpis.avgWaitMin === null ? "—" : `${kpis.avgWaitMin} min`,
          icon: Clock,
        },
        {
          label: "Slot utilization (90 min)",
          value: `${Math.round(kpis.utilization * 100)}%`,
          icon: Gauge,
        },
        { label: "Orders re-slotted", value: String(kpis.reslotted), icon: Repeat },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Today at the canteen</h1>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy={!kpis}>
        {!kpis
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : cards.map((c) => (
              <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-soft">
                <c.icon className="size-5 text-primary" />
                <p className="mt-3 font-display text-3xl font-bold tabular">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Slot load, next 90 minutes</h2>
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
                <caption className="sr-only">Load per station per 5-minute slot</caption>
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

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
            <Activity className="size-5" />
            Recent activity
          </h2>
          {!ready ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet today.</p>
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
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
                    <p>{a.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(a.at, { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
