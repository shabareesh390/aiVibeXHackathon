import { Minus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import type { CartItem } from "@/types";
import { inr } from "@/lib/time";
import { cn } from "@/lib/utils";

export function CartList({
  cart,
  onChange,
  readOnly,
}: {
  cart: CartItem[];
  onChange?: (c: CartItem[]) => void;
  readOnly?: boolean;
}) {
  const menu = useAppStore((s) => s.menu);
  const update = (i: number, patch: Partial<CartItem>) =>
    onChange?.(cart.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = cart.reduce(
    (s, l) => s + (menu.find((m) => m.id === l.itemId)?.price ?? 0) * l.qty,
    0,
  );
  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <ul className="divide-y">
        {cart.map((line, i) => {
          const m = menu.find((x) => x.id === line.itemId);
          if (!m) return null;
          const unused = m.modifiers.filter((x) => !line.modifiers.includes(x));
          return (
            <li key={`${line.itemId}-${i}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-muted-foreground tabular">{inr(m.price)} each</p>
                </div>
                <p className="font-semibold tabular">{inr(m.price * line.qty)}</p>
              </div>
              {(line.modifiers.length > 0 || (!readOnly && unused.length > 0)) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {line.modifiers.map((mod) => (
                    <span
                      key={mod}
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                    >
                      {mod}
                      {!readOnly && (
                        <button
                          type="button"
                          aria-label={`Remove ${mod}`}
                          onClick={() =>
                            update(i, { modifiers: line.modifiers.filter((x) => x !== mod) })
                          }
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {!readOnly &&
                    unused.map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => update(i, { modifiers: [...line.modifiers, mod] })}
                        className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        + {mod}
                      </button>
                    ))}
                </div>
              )}
              {!readOnly ? (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full"
                      aria-label={`One less ${m.name}`}
                      onClick={() => update(i, { qty: Math.max(1, line.qty - 1) })}
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center font-semibold tabular" aria-live="polite">
                      {line.qty}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full"
                      aria-label={`One more ${m.name}`}
                      onClick={() => update(i, { qty: line.qty + 1 })}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => onChange?.(cart.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Qty {line.qty}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className={cn("flex items-center justify-between border-t px-4 py-3")}>
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="font-display text-xl font-bold tabular">{inr(total)}</span>
      </div>
    </div>
  );
}
