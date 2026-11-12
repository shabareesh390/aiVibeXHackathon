import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  PackageSearch,
  Timer,
  Utensils,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CartList } from "@/components/dq/CartList";
import { EmptyState } from "@/components/dq/EmptyState";
import { acknowledgeReslot, cancelOrder } from "@/services/orderService";
import { useAppStore } from "@/store/appStore";
import { useNow } from "@/lib/hooks";
import { fmtTime, fmtTimeAmPm, inr } from "@/lib/time";
import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "confirmed", label: "Order Confirmed" },
  { id: "cooking", label: "Preparing" },
  { id: "ready", label: "Ready for Pickup" },
  { id: "collected", label: "Collected" },
];

function getStageIndex(status: OrderStatus): number {
  if (status === "placed" || status === "scheduled") return 0;
  if (status === "cooking") return 1;
  if (status === "ready") return 2;
  if (status === "collected") return 3;
  return -1;
}

export function TrackView({ orderId }: { orderId: string }) {
  const ready = useAppStore((s) => s.ready);
  const order = useAppStore((s) => s.orders.find((o) => o.id === orderId));
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied",
  );

  useEffect(() => {
    if (order?.status === "ready" && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(`Order #${order.number} Ready!`, {
            body: `Your order is hot and ready at Shelf #${order.shelf ?? 1}.`,
            icon: "/icon.svg",
          });
        } catch {
          /* ignore */
        }
      }
    }
  }, [order?.status, order?.shelf, order?.number]);

  const requestNotif = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
      if (res === "granted") toast.success("Browser notifications enabled!");
    }
  };

  if (!ready)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  if (!order)
    return (
      <EmptyState
        icon={<PackageSearch />}
        title="We couldn't find that order"
        body="It may have been from an older demo session."
        action={
          <Button asChild className="rounded-full">
            <Link to="/student/order">Place a new order</Link>
          </Button>
        }
      />
    );

  const stageIdx = getStageIndex(order.status);
  const secs = Math.max(0, Math.round((order.slotTime - now) / 1000));
  const mm = Math.floor(secs / 60),
    ss = secs % 60;
  const showReslot = order.reslot && !order.reslot.acknowledged && order.status !== "cancelled";
  const canCancel = order.status === "placed" || order.status === "scheduled";

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Token
            </span>
            {notifPermission === "default" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full gap-1"
                onClick={requestNotif}
              >
                <Bell className="size-3" /> Enable Alerts
              </Button>
            )}
          </div>
          <h1 className="font-display text-4xl font-extrabold text-primary">#{order.number}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Pickup slot</p>
          <span className="font-display text-2xl font-bold text-foreground tabular">
            {fmtTimeAmPm(order.slotTime)}
          </span>
        </div>
      </section>

      {showReslot && order.reslot && (
        <section
          role="alert"
          className="rounded-2xl border-2 border-load-busy bg-load-busy-soft p-4"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-load-busy" />
            <p className="font-medium">
              Your pickup moved from {fmtTime(order.reslot.from)} to {fmtTime(order.reslot.to)}{" "}
              because {order.reslot.reason}.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button className="h-11 rounded-xl" onClick={() => acknowledgeReslot(order.id)}>
              OK
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await cancelOrder(order.id, "Student cancelled after reschedule");
                setBusy(false);
                toast("Order cancelled. Refund on its way if you paid by UPI.");
              }}
            >
              Cancel order
            </Button>
          </div>
        </section>
      )}

      {order.status === "cancelled" ? (
        <EmptyState
          title="This order was cancelled"
          body={order.cancelReason ? `Reason: ${order.cancelReason}` : undefined}
          action={
            <Button asChild className="rounded-full">
              <Link to="/student/order">Order again</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_360px] md:items-start">
          <div className="space-y-6">
            {/* Visual 4-Stage Progress Stepper */}
            <section
              className="rounded-2xl border bg-card p-5 shadow-soft"
              aria-label="Order status"
            >
              <ol className="flex items-start justify-between">
                {STAGES.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex flex-1 flex-col items-center gap-1.5 text-center"
                    aria-current={i === stageIdx ? "step" : undefined}
                  >
                    <div className="relative flex w-full items-center justify-center">
                      {i > 0 && (
                        <span
                          className={cn(
                            "absolute right-1/2 h-1 w-full -translate-x-3",
                            i <= stageIdx ? "bg-primary" : "bg-muted",
                          )}
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold transition",
                          i < stageIdx
                            ? "bg-primary text-primary-foreground"
                            : i === stageIdx
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/25"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {i < stageIdx ? <Check className="size-4" /> : i + 1}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        i <= stageIdx ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {order.status === "ready" ? (
              <section
                className="rounded-2xl bg-load-free p-6 text-center text-load-foreground shadow-soft"
                aria-live="polite"
              >
                <p className="text-sm font-semibold uppercase tracking-wider">Ready on shelf</p>
                <p className="font-display text-7xl font-extrabold tabular">{order.shelf ?? 1}</p>
                <p className="mt-1 text-sm font-medium">
                  Scan this QR code or show Token #{order.number} at Shelf #{order.shelf ?? 1} to
                  collect.
                </p>
              </section>
            ) : order.status !== "collected" ? (
              <section className="rounded-2xl bg-warm p-6 text-center text-primary-foreground shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-wider">
                  {secs > 0 ? "Pickup countdown" : "Pickup slot"}
                </p>
                <p className="font-display text-6xl font-extrabold tabular" aria-live="off">
                  {secs > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : "Ready Soon"}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {order.status === "cooking"
                    ? "Kitchen is actively cooking your items right now."
                    : "We'll sequence preparation so it's fresh and hot when you arrive."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs opacity-90">
                  <span className="flex items-center gap-1">
                    <Timer className="size-3.5" /> Prep: ~{order.estimatedPrepMin ?? 5} min
                  </span>
                  <span>·</span>
                  <span>Slot: {fmtTimeAmPm(order.slotTime)}</span>
                </div>
              </section>
            ) : (
              <EmptyState
                icon={<Check />}
                title="Collected. Enjoy your meal!"
                body="Thank you for using Dequeue smart pre-ordering."
                action={
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/student/history">See past orders</Link>
                  </Button>
                }
              />
            )}

            {order.status !== "collected" && (
              <section className="mx-auto flex w-fit flex-col items-center gap-2 rounded-2xl border bg-card p-5 shadow-soft">
                <QRCode
                  value={`DEQUEUE:${order.id}`}
                  size={140}
                  bgColor="transparent"
                  fgColor="currentColor"
                  aria-label={`QR code for order ${order.number}`}
                />
                <span className="text-xs text-muted-foreground font-medium">
                  Collection Token #{order.number}
                </span>
              </section>
            )}

            {canCancel && (
              <div className="text-center">
                <Button
                  variant="outline"
                  className="rounded-xl text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await cancelOrder(order.id, "Cancelled by student before preparation");
                    setBusy(false);
                    toast.success("Order cancelled");
                  }}
                >
                  <XCircle className="size-4" /> Cancel this order
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Orders can be cancelled before the kitchen begins cooking.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-display text-lg font-semibold md:text-xl">Order Summary</h2>
              <span className="font-bold tabular text-primary text-lg">{inr(order.total)}</span>
            </div>
            <CartList cart={order.items} readOnly />
            <div className="rounded-2xl border bg-card p-4 text-xs space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Payment method</span>
                <span className="font-semibold uppercase text-foreground">{order.payment}</span>
              </div>
              <div className="flex justify-between">
                <span>Order placed</span>
                <span className="font-medium text-foreground">{fmtTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pickup window</span>
                <span className="font-medium text-foreground">{fmtTime(order.slotTime)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
