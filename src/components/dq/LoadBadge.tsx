import type { Load } from "@/types";
import { cn } from "@/lib/utils";
import { loadClasses, loadLabel } from "@/lib/load";

export function LoadBadge({
  load,
  className,
  label,
}: {
  load: Load;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        loadClasses[load].solid,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-load-foreground/70" aria-hidden />
      {label ?? loadLabel[load]}
    </span>
  );
}

export function LoadBar({
  ratio,
  load,
  className,
}: {
  ratio: number;
  load: Load;
  className?: string;
}) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", loadClasses[load].solid)}
        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
      />
    </div>
  );
}
