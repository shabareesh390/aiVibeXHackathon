import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, Clock, CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dq/EmptyState";
import { LoadBadge } from "@/components/dq/LoadBadge";
import { getSlots } from "@/services/slotService";
import { cartTotal, placeOrder } from "@/services/orderService";
import { useAppStore } from "@/store/appStore";
import { useSession } from "@/store/sessionStore";
import type { Order, PaymentMethod, Slot } from "@/types";
import { fmtTime, fmtTimeAmPm, inr } from "@/lib/time";
import { loadClasses } from "@/lib/load";
import { cn } from "@/lib/utils";

export function SlotsView() {
  const ready = useAppStore((s) => s.ready);
  const orders = useAppStore((s) => s.orders);
  const { cart, window: win, user, set } = useSession();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [step, setStep] = useState<"pay" | "processing" | "done">("pay");
  const [placed, setPlaced] = useState<Order | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || !cart.length) return;
    setSlots(null);
    getSlots(cart, win).then(setSlots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cart, win, orders.length]);

  if (ready && !cart.length && !placed) {
    return <EmptyState icon={<Clock />} title="Nothing to schedule yet" body="Add something to your cart and we'll find you a pickup slot." action={<Button asChild className="rounded-full"><Link to="/student/order">Start an order</Link></Button>} />;
  }

  const pay = async (method: PaymentMethod) => {
    if (!chosen) return;
    setStep("processing");
    const order = await placeOrder({ items: cart, slotTime: chosen.startTime, payment: method, studentName: user?.name ?? "Student" });
    setPlaced(order);
    setStep("done");
    set({ cart: [], text: "", unresolved: [], lastOrderId: order.id, window: { asap: true } });
    toast.success(`Order #${order.number} confirmed`);
  };

  const recommended = slots?.filter((s) => s.recommended) ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold">Pick your pickup</h1>
        <p className="text-sm text-muted-foreground">Based on what the kitchen can actually cook. {cart.length > 0 && <>Total {inr(cartTotal(cart))}.</>}</p>
      </section>

      <section className="space-y-3" aria-label="Recommended slots" aria-busy={!slots}>
        {!slots ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : recommended.length === 0 ? (
          <EmptyState title="Every slot in your window is full" body="Try widening your free window or ordering something from a quieter station." />
        ) : recommended.map((s, i) => (
          <button key={s.startTime} type="button" onClick={() => { setChosen(s); setStep("pay"); }} className={cn("w-full rounded-2xl border-2 bg-card p-5 text-left shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring", i === 0 ? "border-primary" : "border-transparent")}>
            <div className="flex items-start justify-between">
              <div>
                {i === 0 && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">Best pick</p>}
                <p className="font-display text-4xl font-extrabold tabular">{fmtTime(s.startTime)}</p>
                <p className="text-sm text-muted-foreground">Ready by {fmtTimeAmPm(s.readyBy)}</p>
              </div>
              <LoadBadge load={s.load} />
            </div>
            <p className="mt-3 text-sm">{s.reason}</p>
          </button>
        ))}
      </section>

      {slots && slots.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="h-12 w-full justify-between rounded-2xl">All slots <ChevronDown /></Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button key={s.startTime} type="button" disabled={s.load === "red"} onClick={() => { setChosen(s); setStep("pay"); }} aria-label={`${fmtTimeAmPm(s.startTime)}, ${s.reason}`} className={cn("rounded-xl border-2 py-3 text-center text-sm font-semibold tabular transition focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:line-through", loadClasses[s.load].soft, loadClasses[s.load].border)}>
                  {fmtTime(s.startTime)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground"><LoadBadge load="green" /><LoadBadge load="amber" /><LoadBadge load="red" /></div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog open={!!chosen} onOpenChange={(o) => { if (!o) { if (placed) navigate({ to: "/student/track/$orderId", params: { orderId: placed.id } }); setChosen(null); } }}>
        <DialogContent className="max-w-sm rounded-3xl">
          {step !== "done" ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Pickup at {chosen && fmtTime(chosen.startTime)}</DialogTitle>
                <DialogDescription>Pay now to lock this slot, or pay at the counter when you pick up.</DialogDescription>
              </DialogHeader>
              <p className="text-center font-display text-3xl font-bold tabular">{inr(cartTotal(cart))}</p>
              <div className="grid gap-3">
                <Button className="h-14 rounded-2xl text-base" disabled={step === "processing"} onClick={() => pay("upi")}>{step === "processing" ? <Loader2 className="animate-spin" /> : <Smartphone />}Pay with UPI</Button>
                <Button variant="outline" className="h-14 rounded-2xl text-base" disabled={step === "processing"} onClick={() => pay("counter")}><Wallet />Pay at pickup</Button>
              </div>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><CreditCard className="size-3" />Demo payment, no money moves.</p>
            </>
          ) : placed && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-load-free" />
              <DialogHeader className="mt-2 items-center">
                <DialogTitle className="font-display text-2xl">Order #{placed.number} confirmed</DialogTitle>
                <DialogDescription>Show this at the pickup shelf at {fmtTimeAmPm(placed.slotTime)}.</DialogDescription>
              </DialogHeader>
              <div className="mx-auto my-5 w-fit rounded-2xl bg-card p-4 ring-1 ring-border">
                <QRCode value={`DEQUEUE:${placed.id}`} size={168} bgColor="transparent" fgColor="currentColor" aria-label={`QR code for order ${placed.number}`} />
              </div>
              <Button className="h-12 w-full rounded-2xl" onClick={() => navigate({ to: "/student/track/$orderId", params: { orderId: placed.id } })}>Track my order</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
