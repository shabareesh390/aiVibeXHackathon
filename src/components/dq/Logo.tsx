import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-warm text-primary-foreground shadow-soft" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 7h11M4 12h16M4 17h8" /></svg>
      </span>
      Dequeue
    </span>
  );
}
