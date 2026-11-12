import { Link, useNavigate } from "@tanstack/react-router";
import {
  Armchair,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Loader2,
  QrCode,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [step, setStep] = useState<"pay" | "upi_qr" | "done">("pay");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [instructions, setInstructions] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const upiId = (import.meta.env["VITE_UPI_ID"] as string | undefined) || "shabareesh390@okicici";
  const upiName = (import.meta.env["VITE_UPI_NAME"] as string | undefined) || "Shabareesh";
  const totalAmount = cartTotal(cart);
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(
    `Order for ${user?.name || "Student"}`,
  )}`;

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success(`Copied UPI ID: ${upiId}`);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!ready || !cart.length) return;
    setSlots(null);
    getSlots(cart, win).then(setSlots);
  }, [ready, cart, win, orders.length]);

  if (ready && !cart.length && !placed) {
    return (
      <EmptyState
        icon={<Armchair />}
        title="No seats to schedule yet"
        body="Add food items to your cart and we'll show you free seats and pickup slots."
        action={
          <Button asChild className="rounded-full">
            <Link to="/student/order">Start an order</Link>
          </Button>
        }
      />
    );
  }

  const pay = async (method: PaymentMethod) => {
    if (!chosen || submitting) return;
    setSubmitting(true);
    try {
      const order = await placeOrder({
        items: cart,
        slotTime: chosen.startTime,
        payment: method,
        studentName: user?.name ?? "Student",
        instructions: instructions.trim() || undefined,
      });
      setPlaced(order);
      setStep("done");
      set({ cart: [], text: "", unresolved: [], lastOrderId: order.id, window: { asap: true } });
      toast.success(`Order #${order.number} confirmed`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to book slot. Please try another slot.");
    } finally {
      setSubmitting(false);
    }
  };

  const recommended = slots?.filter((s) => s.recommended) ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Available Seats & Free Slots
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time canteen seating & pickup capacity. Select an open slot with free seats.{" "}
          {cart.length > 0 && (
            <span className="font-medium text-foreground">Total {inr(cartTotal(cart))}.</span>
          )}
        </p>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Recommended slots with free seats"
        aria-busy={!slots}
      >
        {!slots ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : recommended.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              title="Every slot in your window is full"
              body="Try widening your free window or ordering something from a quieter station."
            />
          </div>
        ) : (
          recommended.map((s, i) => (
            <button
              key={s.startTime}
              type="button"
              onClick={() => {
                setChosen(s);
                setStep("pay");
              }}
              className={cn(
                "flex flex-col justify-between rounded-2xl border-2 bg-card p-5 text-left shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring",
                i === 0 ? "border-primary" : "border-transparent",
              )}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    {i === 0 && (
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                        Best pick
                      </p>
                    )}
                    <p className="font-display text-4xl font-extrabold tabular">
                      {fmtTime(s.startTime)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ready by {fmtTimeAmPm(s.readyBy)}
                    </p>
                  </div>
                  <LoadBadge load={s.load} />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
                  <Armchair className="size-4 text-primary" />
                  <span
                    className={cn(
                      s.capacityLeft > 0 ? "text-foreground" : "text-destructive font-bold",
                    )}
                  >
                    {s.capacityLeft > 0
                      ? `${s.capacityLeft} seats / spots free`
                      : "0 seats free (Full)"}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{s.reason}</p>
            </button>
          ))
        )}
      </section>

      {slots && slots.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="h-12 w-full justify-between rounded-2xl">
              All slots & free seats <ChevronDown />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {slots.map((s) => (
                <button
                  key={s.startTime}
                  type="button"
                  disabled={s.load === "red"}
                  onClick={() => {
                    setChosen(s);
                    setStep("pay");
                  }}
                  aria-label={`${fmtTimeAmPm(s.startTime)}, ${s.capacityLeft} seats free, ${s.reason}`}
                  className={cn(
                    "rounded-xl border-2 py-2 px-1 text-center tabular transition focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:line-through",
                    loadClasses[s.load].soft,
                    loadClasses[s.load].border,
                  )}
                >
                  <span className="block text-sm font-semibold">{fmtTime(s.startTime)}</span>
                  <span className="block text-[11px] font-medium opacity-85">
                    {s.capacityLeft > 0 ? `${s.capacityLeft} seats` : "Full"}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground">
              <LoadBadge load="green" />
              <LoadBadge load="amber" />
              <LoadBadge load="red" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog
        open={!!chosen}
        onOpenChange={(o) => {
          if (!o) {
            if (placed) navigate({ to: "/student/track/$orderId", params: { orderId: placed.id } });
            setChosen(null);
            setStep("pay");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl">
          {step === "upi_qr" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("pay")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Back
                </button>
                <span className="rounded-full bg-load-free-soft px-2.5 py-0.5 text-xs font-semibold text-load-free">
                  Instant UPI
                </span>
              </div>

              <DialogHeader className="text-center sm:text-center">
                <DialogTitle className="font-display text-2xl">Scan & Pay via UPI</DialogTitle>
                <DialogDescription>
                  Scan the QR code with GPay, PhonePe, Paytm, or BHIM.
                </DialogDescription>
              </DialogHeader>

              <p className="text-center font-display text-3xl font-extrabold tabular text-primary">
                {inr(totalAmount)}
              </p>

              {/* Dynamic NPCI UPI QR Code */}
              <div className="mx-auto flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
                <QRCode
                  value={upiUri}
                  size={176}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  aria-label="Scan to pay with any UPI app"
                />
                <p className="mt-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                  NPCI UPI • GPay • PhonePe • Paytm
                </p>
              </div>

              {/* Payee Info & Copy UPI ID */}
              <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground">To: </span>
                  <span className="font-semibold text-foreground">{upiName}</span>
                  <p className="font-mono text-muted-foreground">{upiId}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyUpiId}
                  className="h-8 gap-1 rounded-lg text-xs font-medium"
                >
                  {copied ? (
                    <Check className="size-3 text-load-free" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy UPI"}
                </Button>
              </div>

              {/* Mobile Direct Intent Link */}
              <a
                href={upiUri}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow transition hover:opacity-95 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Smartphone className="size-4" />
                Pay via UPI App (Mobile)
              </a>

              {/* Confirm Payment button */}
              <Button
                className="h-14 w-full rounded-2xl text-base font-semibold"
                disabled={submitting}
                onClick={() => pay("upi")}
              >
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 className="size-5 mr-1 text-load-free" />
                )}
                I Have Paid — Lock Slot
              </Button>
            </div>
          ) : step === "pay" ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  Slot at {chosen && fmtTime(chosen.startTime)}{" "}
                  {chosen && chosen.capacityLeft > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({chosen.capacityLeft} seats free)
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Confirm your slot and table seating. Pay now or at pickup.
                </DialogDescription>
              </DialogHeader>
              <p className="text-center font-display text-3xl font-bold tabular">
                {inr(cartTotal(cart))}
              </p>
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="instructions"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Special instructions (optional)
                </label>
                <input
                  id="instructions"
                  type="text"
                  placeholder="e.g. Less spicy, pack sambar separately"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="grid gap-3">
                <Button
                  className="h-14 rounded-2xl text-base"
                  disabled={submitting}
                  onClick={() => setStep("upi_qr")}
                >
                  <QrCode className="size-5 mr-1" />
                  Pay with UPI (GPay / PhonePe / QR)
                </Button>
                <Button
                  variant="outline"
                  className="h-14 rounded-2xl text-base"
                  disabled={submitting}
                  onClick={() => pay("counter")}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Wallet />}
                  Pay at pickup counter
                </Button>
              </div>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <CreditCard className="size-3" />
                Instant online UPI or pay at canteen counter.
              </p>
            </>
          ) : (
            placed && (
              <div className="text-center">
                <CheckCircle2 className="mx-auto size-12 text-load-free" />
                <DialogHeader className="mt-2 items-center">
                  <DialogTitle className="font-display text-2xl">
                    Order #{placed.number} confirmed
                  </DialogTitle>
                  <DialogDescription>
                    Show this at the pickup shelf at {fmtTimeAmPm(placed.slotTime)}.
                  </DialogDescription>
                </DialogHeader>
                <div className="mx-auto my-5 w-fit rounded-2xl bg-card p-4 ring-1 ring-border">
                  <QRCode
                    value={`DEQUEUE:${placed.id}`}
                    size={168}
                    bgColor="transparent"
                    fgColor="currentColor"
                    aria-label={`QR code for order ${placed.number}`}
                  />
                </div>
                <Button
                  className="h-12 w-full rounded-2xl"
                  onClick={() =>
                    navigate({ to: "/student/track/$orderId", params: { orderId: placed.id } })
                  }
                >
                  Track my order
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
