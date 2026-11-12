import type { Load } from "@/types";

/** Shared thresholds so every screen uses the same green / amber / red. */
export function ratioToLoad(ratio: number): Load {
  if (ratio >= 1) return "red";
  if (ratio >= 0.6) return "amber";
  return "green";
}

export const loadLabel: Record<Load, string> = { green: "Free", amber: "Busy", red: "Full" };

export const loadClasses: Record<
  Load,
  { solid: string; soft: string; text: string; border: string }
> = {
  green: {
    solid: "bg-load-free text-load-foreground",
    soft: "bg-load-free-soft",
    text: "text-load-free",
    border: "border-load-free",
  },
  amber: {
    solid: "bg-load-busy text-load-foreground",
    soft: "bg-load-busy-soft",
    text: "text-load-busy",
    border: "border-load-busy",
  },
  red: {
    solid: "bg-load-full text-load-foreground",
    soft: "bg-load-full-soft",
    text: "text-load-full",
    border: "border-load-full",
  },
};
