import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, PackageSearch } from "lucide-react";
import { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CartList } from "@/components/dq/CartList";
import { EmptyState } from "@/components/dq/EmptyState";
import { acknowledgeReslot, cancelOrder } from "@/services/orderService";
import { useAppStore } from "@/store/appStore";
import { useNow } from "@/lib/hooks";
import { fmtTime, fmtTimeAmPm } from "@/lib/time";
import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const STEPS: { id: OrderStatus; label: string }[] = [
  { id: "placed", label: "Placed" }, { id: "scheduled", label: "Scheduled" }, { id: "cooking", label: "Cooking" }, { id: "ready", label: "Ready" }, { id: "collected", label: "Collected" },
];

export function TrackView({ orderId }: { orderId: string }) {
  const ready = useAppStore((s) => s.ready);
  const order = useAppStore((s) => s.orders.find((o) => o.id === orderId));
  const now = useNow();
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="space-y-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;
  if (!order) return <EmptyState icon={<PackageSearch />} title="We couldn't find that order" body="It may have been from an older demo session." action={<Button asChild className="rounded-full"><Link to="/student/order">Place a new order</Link></Button>} />;

  const idx = STEPS.findIndex((s) => s.id === order.status);
  const secs = Math.max(0, Math.round((order.slotTime - now) / 1000));
  const mm = Math.floor(secs / 60), ss = secs % 60;
  const showReslot = order.reslot && !order.reslot.acknowledged && order.status !== "cancelled";

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Order</p>
          <h1 className="font-display text-3xl font-extrabold">#{order.number}</h1>
        </div>
        <p className="text-right text-sm text-muted-foreground">Pickup<br /><span className="font-display text-xl font-bold text-foreground tabular">{fmtTimeAmPm(order.slotTime)}</span></p>
      </section>

      {showReslot && order.reslot && (
        <section role="alert" className="rounded-2xl border-2 border-load-busy bg-load-busy-soft p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-load-busy" />
            <p className="font-medium">Your pickup moved from {fmtTime(order.reslot.from)} to {fmtTime(order.reslot.to)} because {order.reslot.reason}.</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button className="h-11 rounded-xl" onClick={() => acknowledgeReslot(order.id)}>OK</Button>
            <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={async () => { setBusy(true); await cancelOrder(order.id); setBusy(false); toast("Order cancelled. Refund on its way if you paid by UPI."); }}>Cancel order</Button>
          </div>
        </section>
      )}

      {order.status === "cancelled" ? (
        <EmptyState title="This order was cancelled" action={<Button asChild className="rounded-full"><Link to="/student/order">Order again</Link></Button>} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_360px] md:items-start">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5 shadow-soft" aria-label="Order status">
              <ol className="flex items-start justify-between">
                {STEPS.map((s, i) => (
                  <li key={s.id} className="flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={i === idx ? "step" : undefined}>
                    <div className="relative flex w-full items-center justify-center">
                      {i > 0 && <span className={cn("absolute right-1/2 h-1 w-full -translate-x-3", i <= idx ? "bg-primary" : "bg-muted")} aria-hidden />}
                      <span className={cn("relative z-10 grid size-7 place-items-center rounded-full text-xs font-bold", i < idx ? "bg-primary text-primary-foreground" : i === idx ? "bg-primary text-primary-foreground ring-4 ring-primary/25" : "bg-muted text-muted-foreground")}>
                        {i < idx ? <Check className="size-4" /> : i + 1}
                      </span>
                    </div>
                    <span className={cn("text-[11px] font-medium", i <= idx ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                  </li>
                ))}
              </ol>
            </section>

            {order.status === "ready" ? (
              <section className="rounded-2xl bg-load-free p-6 text-center text-load-foreground shadow-soft" aria-live="polite">
                <p className="text-sm font-semibold uppercase tracking-wider">Ready on shelf</p>
                <p className="font-display text-7xl font-extrabold tabular">{order.shelf}</p>
                <p className="text-sm">Scan the QR at the shelf to collect.</p>
              </section>
            ) : order.status !== "collected" ? (
              <section className="rounded-2xl bg-warm p-6 text-center text-primary-foreground shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-wider">{secs > 0 ? "Pickup in" : "Pickup time"}</p>
                <p className="font-display text-6xl font-extrabold tabular" aria-live="off">{secs > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : "Now"}</p>
                <p className="text-sm">{order.status === "cooking" ? "It's on the tawa right now." : "We'll start cooking so it's hot when you arrive."}</p>
              </section>
            ) : (
              <EmptyState icon={<Check />} title="Collected. Enjoy your meal!" action={<Button asChild variant="outline" className="rounded-full"><Link to="/student/history">See history</Link></Button>} />
            )}

            {order.status !== "collected" && (
              <section className="mx-auto flex w-fit flex-col items-center gap-2 rounded-2xl border bg-card p-4">
                <QRCode value={`DEQUEUE:${order.id}`} size={140} bgColor="transparent" fgColor="currentColor" aria-label={`QR code for order ${order.number}`} />
                <span className="text-xs text-muted-foreground">Scan at canteen counter</span>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold md:text-xl">Order details</h2>
            <CartList cart={order.items} readOnly />
          </div>
        </div>
      )}
    </div>
  );
}
