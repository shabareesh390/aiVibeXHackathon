import { useNavigate } from "@tanstack/react-router";
import { Loader2, Mic, MicOff, Sparkles, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CartList } from "@/components/dq/CartList";
import { EmptyState } from "@/components/dq/EmptyState";
import { parseOrder } from "@/services/menuService";
import { useAppStore } from "@/store/appStore";
import { useSession } from "@/store/sessionStore";
import type { CartItem } from "@/types";
import { format } from "date-fns";

type SR = {
  start: () => void;
  stop: () => void;
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
};

const toInput = (ms?: number) => (ms ? format(ms, "HH:mm") : "");
const fromInput = (v: string) => {
  const [h = 0, m = 0] = v.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

export function OrderView() {
  const ready = useAppStore((s) => s.ready);
  const menu = useAppStore((s) => s.menu);
  const { text, cart, unresolved, window: win, set } = useSession();
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<SR | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.onresult = (e) =>
      set({
        text: Array.from(e.results)
          .map((r) => r[0]?.transcript ?? "")
          .join(" "),
      });
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("Couldn't hear that. Try again or type it.");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const understand = async () => {
    if (!text.trim()) {
      toast("Tell us what you'd like first");
      return;
    }
    setLoading(true);
    const r = await parseOrder(text);
    setLoading(false);
    const merged = [...cart];
    for (const it of r.items) {
      const ex = merged.find(
        (m) => m.itemId === it.itemId && m.modifiers.join() === it.modifiers.join(),
      );
      if (ex) ex.qty += it.qty;
      else merged.push(it);
    }
    set({
      cart: merged,
      unresolved: r.unresolved,
      window: r.readyBy ? { asap: false, start: Date.now(), end: r.readyBy } : win,
    });
    if (r.notFound.length) toast.warning(`Not on today's menu: ${r.notFound.join(", ")}`);
    else if (r.items.length)
      toast.success(`Added ${r.items.reduce((s, i) => s + i.qty, 0)} item(s) to your cart`);
  };

  const resolve = (uid: string, itemId: string) => {
    const u = unresolved.find((x) => x.id === uid);
    if (!u) return;
    set({
      cart: [...cart, { itemId, qty: u.qty, modifiers: u.modifiers }],
      unresolved: unresolved.filter((x) => x.id !== uid),
      text: "",
    });
  };

  const quickAdd = (itemId: string) => {
    const ex = cart.find((c) => c.itemId === itemId && c.modifiers.length === 0);
    set({
      cart: ex
        ? cart.map((c) => (c === ex ? { ...c, qty: c.qty + 1 } : c))
        : [...cart, { itemId, qty: 1, modifiers: [] } as CartItem],
    });
  };

  if (!ready) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-10 rounded-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  const quick = menu.filter((m) => m.available).slice(0, 16);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-6">
        <section>
          <h1 className="font-display text-2xl font-bold md:text-3xl">What are you craving?</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Type or say it the way you'd tell a friend.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-3 shadow-soft focus-within:ring-2 focus-within:ring-ring md:p-4">
          <Label htmlFor="order-text" className="sr-only">
            Your order
          </Label>
          <Textarea
            id="order-text"
            value={text}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="Try: 2 masala dosa and a filter coffee, ready by 1 pm"
            className="min-h-28 resize-none border-0 bg-transparent p-1 text-lg shadow-none focus-visible:ring-0 md:min-h-32"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) understand();
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant={listening ? "destructive" : "secondary"}
              size="icon"
              className="size-12 rounded-full"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Speak your order"}
              disabled={!speechOk && !listening}
              title={speechOk ? undefined : "Voice input isn't supported in this browser"}
            >
              {listening ? <MicOff /> : <Mic />}
            </Button>
            <Button
              type="button"
              onClick={understand}
              disabled={loading}
              className="h-12 flex-1 rounded-full text-base font-semibold"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}Understand my order
            </Button>
          </div>
          {listening && (
            <p className="mt-2 text-sm text-primary" aria-live="polite">
              Listening… speak now
            </p>
          )}
        </section>

        <section aria-label="Quick add">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick add popular items
          </p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
            {quick.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => quickAdd(m.id)}
                className="shrink-0 rounded-full border bg-card px-3.5 py-2 text-sm font-medium shadow-soft transition hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                + {m.name}
              </button>
            ))}
          </div>
        </section>

        {unresolved.length > 0 && (
          <section className="space-y-3" aria-label="Needs a quick answer">
            {unresolved.map((u) => (
              <div key={u.id} className="rounded-2xl border-2 border-primary/40 bg-accent/60 p-4">
                <p className="font-semibold">
                  {u.question}{" "}
                  <span className="font-normal text-muted-foreground">
                    (“{u.phrase}”, ×{u.qty})
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {u.options.map((id) => {
                    const m = menu.find((x) => x.id === id)!;
                    return (
                      <Button
                        key={id}
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full"
                        onClick={() => resolve(u.id, id)}
                      >
                        {m.name}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 rounded-full text-muted-foreground"
                    onClick={() => set({ unresolved: unresolved.filter((x) => x.id !== u.id) })}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="space-y-6 lg:sticky lg:top-24">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold md:text-xl">Your cart</h2>
          {cart.length ? (
            <CartList cart={cart} onChange={(c) => set({ cart: c })} />
          ) : (
            <EmptyState
              icon={<UtensilsCrossed />}
              title="Cart is empty"
              body="Describe your order or tap a quick-add chip."
            />
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="asap" className="text-base font-semibold">
                As soon as possible (Under 15 min)
              </Label>
              <p className="text-sm text-muted-foreground">
                Express pickup guarantee: Ready under 15 minutes.
              </p>
            </div>
            <Switch
              id="asap"
              checked={win.asap}
              onCheckedChange={(v) =>
                set({
                  window: v
                    ? { asap: true }
                    : {
                        asap: false,
                        start: Date.now() + 15 * 60_000,
                        end: Date.now() + 60 * 60_000,
                      },
                })
              }
            />
          </div>
          {!win.asap && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">Free from</Label>
                <Input
                  id="from"
                  type="time"
                  className="h-12 rounded-xl"
                  value={toInput(win.start)}
                  onChange={(e) =>
                    e.target.value && set({ window: { ...win, start: fromInput(e.target.value) } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">Until</Label>
                <Input
                  id="to"
                  type="time"
                  className="h-12 rounded-xl"
                  value={toInput(win.end)}
                  onChange={(e) =>
                    e.target.value && set({ window: { ...win, end: fromInput(e.target.value) } })
                  }
                />
              </div>
            </div>
          )}
        </section>

        <Button
          className="h-14 w-full rounded-2xl text-base font-semibold"
          disabled={!cart.length || unresolved.length > 0}
          onClick={() => navigate({ to: "/student/slots" })}
        >
          Find available seats & slots
        </Button>
        {unresolved.length > 0 && (
          <p className="-mt-3 text-center text-sm text-muted-foreground">
            Answer the question above to continue.
          </p>
        )}
      </div>
    </div>
  );
}
