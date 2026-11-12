import { Link, useNavigate } from "@tanstack/react-router";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dq/EmptyState";
import { useAppStore } from "@/store/appStore";
import { useSession } from "@/store/sessionStore";
import type { Order } from "@/types";
import { fmtDay, inr } from "@/lib/time";

const statusText: Record<Order["status"], string> = {
  placed: "Placed",
  scheduled: "Scheduled",
  cooking: "Cooking",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
};

export function HistoryView() {
  const ready = useAppStore((s) => s.ready);
  const orders = useAppStore((s) => s.orders);
  const menu = useAppStore((s) => s.menu);
  const set = useSession((s) => s.set);
  const navigate = useNavigate();
  const mine = orders.filter((o) => o.mine).sort((a, b) => b.createdAt - a.createdAt);

  if (!ready)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );

  const reorder = (o: Order) => {
    const items = o.items.filter((l) => menu.find((m) => m.id === l.itemId)?.available);
    if (!items.length) {
      toast.error("Those items aren't available right now");
      return;
    }
    set({ cart: items.map((l) => ({ ...l })), unresolved: [], window: { asap: true } });
    toast.success("Added to your cart");
    navigate({ to: "/student/slots" });
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Your orders</h1>
      {mine.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No orders yet"
          body="Your past orders show up here for quick reordering."
          action={
            <Button asChild className="rounded-full">
              <Link to="/student/order">Order now</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {mine.map((o) => (
            <li
              key={o.id}
              className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {o.items
                      .map(
                        (l) => `${l.qty}× ${menu.find((m) => m.id === l.itemId)?.name ?? "Item"}`,
                      )
                      .join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    #{o.number} · {fmtDay(o.slotTime)} · {statusText[o.status]}
                  </p>
                </div>
                <p className="font-semibold tabular">{inr(o.total)}</p>
              </div>
              <div className="mt-4 flex gap-2">
                {["scheduled", "cooking", "ready"].includes(o.status) && (
                  <Button asChild variant="outline" className="h-10 rounded-full">
                    <Link to="/student/track/$orderId" params={{ orderId: o.id }}>
                      Track
                    </Link>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="h-10 rounded-full"
                  onClick={() => reorder(o)}
                >
                  <RotateCcw />
                  Reorder
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
