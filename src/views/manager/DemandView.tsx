import { FlaskConical, Lightbulb } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dq/EmptyState";
import { getDemand, getHistoryDays, simulate } from "@/services/analyticsService";
import { useAppStore } from "@/store/appStore";
import type { DemandRow, SimulationAssumptions } from "@/types";
import { fmtTime } from "@/lib/time";

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" };

export function DemandView() {
  const ready = useAppStore((s) => s.ready);
  const orders = useAppStore((s) => s.orders);
  const [data, setData] = useState<{ slots: number[]; rows: DemandRow[] } | null>(null);
  const [historyDays, setHistoryDays] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    getDemand().then(setData);
    getHistoryDays().then(setHistoryDays);
  }, [ready, orders]);

  const chart = useMemo(() => data?.rows.slice(0, 10).map((r) => ({ name: r.itemName, qty: r.total })) ?? [], [data]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Demand</h1>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-4 font-display text-xl font-semibold">Pre-ordered, next 90 minutes</h2>
          {!data ? <Skeleton className="h-72 rounded-xl" /> : chart.length === 0 ? <EmptyState title="No pre-orders yet" /> : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={130} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="qty" name="Quantity" fill="var(--chart-1)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold"><Lightbulb className="size-5 text-primary" />Prep suggestion</h2>
          {historyDays === null ? <Skeleton className="h-20" /> : historyDays < 14 ? (
            <p className="text-muted-foreground">Not enough history yet. Suggestions start after two weeks of real orders.</p>
          ) : <p>Forecast available.</p>}
        </section>
      </div>

      <section className="rounded-2xl border bg-card shadow-soft">
        <h2 className="px-5 pt-5 font-display text-xl font-semibold">By item and slot</h2>
        <div className="overflow-x-auto p-2">
          {!data ? <Skeleton className="m-3 h-40" /> : (
            <Table>
              <TableHeader><TableRow><TableHead className="sticky left-0 bg-card">Item</TableHead>{data.slots.map((t) => <TableHead key={t} className="text-center tabular">{fmtTime(t)}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.itemId}>
                    <TableCell className="sticky left-0 bg-card font-medium">{r.itemName}</TableCell>
                    {data.slots.map((t) => <TableCell key={t} className="text-center tabular text-muted-foreground">{r.bySlot[t] ? <span className="font-semibold text-foreground">{r.bySlot[t]}</span> : "·"}</TableCell>)}
                    <TableCell className="text-right font-bold tabular">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <SimulationCard />
    </div>
  );
}

function SimulationCard() {
  const [a, setA] = useState<SimulationAssumptions>({ peakArrivalsPerMin: 6, serviceSecPerOrder: 40, counters: 2, preOrderShare: 0.6 });
  const [compare, setCompare] = useState(true);
  const points = useMemo(() => simulate(a), [a]);
  const peakFifo = Math.max(...points.map((p) => p.fifo));
  const peakDq = Math.max(...points.map((p) => p.dequeue));
  const field = (key: keyof SimulationAssumptions, label: string, step: number, scale = 1) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type="number" step={step} min={0} value={Math.round(a[key] * scale * 100) / 100} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) setA({ ...a, [key]: key === "preOrderShare" ? Math.min(1, n / scale) : n / scale }); }} className="rounded-lg" />
    </div>
  );
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><FlaskConical className="size-5 text-primary" />Simulation</h2>
          <p className="text-sm text-muted-foreground">Simulation using measured arrival data. Not a forecast; edit the assumptions to match your counter.</p>
        </div>
        <div className="flex items-center gap-2"><Label htmlFor="cmp">FIFO walk-in vs Dequeue</Label><Switch id="cmp" checked={compare} onCheckedChange={setCompare} /></div>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={points}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="minute" stroke="var(--muted-foreground)" fontSize={12} label={{ value: "Minutes into lunch rush", position: "insideBottom", offset: -2, fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} label={{ value: "People in queue", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {compare && <Line type="monotone" dataKey="fifo" name="FIFO walk-in" stroke="var(--chart-5)" strokeWidth={3} dot={false} />}
                <Line type="monotone" dataKey="dequeue" name="Dequeue" stroke="var(--chart-3)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Peak queue: {compare && <><span className="font-semibold text-foreground">{Math.round(peakFifo)}</span> people with FIFO, </>}<span className="font-semibold text-foreground">{Math.round(peakDq)}</span> with Dequeue.</p>
        </div>
        <fieldset className="space-y-3 rounded-2xl bg-muted p-4">
          <legend className="sr-only">Assumptions</legend>
          <p className="font-semibold">Assumptions</p>
          {field("peakArrivalsPerMin", "Peak arrivals per minute", 0.5)}
          {field("serviceSecPerOrder", "Seconds to serve a walk-in", 5)}
          {field("counters", "Open counters", 1)}
          {field("preOrderShare", "Share who pre-order (%)", 5, 100)}
        </fieldset>
      </div>
    </section>
  );
}
