import { useNavigate } from "@tanstack/react-router";
import { ChefHat, GraduationCap, LineChart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/dq/Logo";
import { ThemeToggle } from "@/components/dq/ThemeToggle";
import { useAppReady } from "@/lib/hooks";
import { useSession } from "@/store/sessionStore";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

const ROLES: { id: Role; label: string; body: string; icon: typeof ChefHat; to: "/student/order" | "/kitchen" | "/manager/dashboard"; defaultName: string }[] = [
  { id: "student", label: "Student", body: "Order in your own words, grab a pickup slot.", icon: GraduationCap, to: "/student/order", defaultName: "Ananya" },
  { id: "kitchen", label: "Kitchen", body: "Batched cooking plan on the tablet.", icon: ChefHat, to: "/kitchen", defaultName: "Kitchen crew" },
  { id: "manager", label: "Manager", body: "Demand, slot load and menu.", icon: LineChart, to: "/manager/dashboard", defaultName: "Mr. Iyer" },
];

export function RoleSelect() {
  useAppReady();
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const setUser = useSession((s) => s.setUser);
  const navigate = useNavigate();
  const current = ROLES.find((r) => r.id === role)!;

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    setUser({ role, name: name.trim() || current.defaultName });
    navigate({ to: current.to });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>
      <section className="mt-10">
        <h1 className="font-display text-4xl font-extrabold leading-tight">
          Skip the canteen queue.<br />
          <span className="text-primary">Eat on time.</span>
        </h1>
        <p className="mt-3 text-muted-foreground">Pre-order, pick a slot the kitchen can really make, and walk straight to your shelf.</p>
      </section>

      <form onSubmit={go} className="mt-8 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">I am using Dequeue as</legend>
          <div className="grid gap-3">
            {ROLES.map((r) => (
              <label key={r.id} className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border-2 bg-card p-4 shadow-soft transition focus-within:ring-2 focus-within:ring-ring", role === r.id ? "border-primary" : "border-transparent")}>
                <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} className="sr-only" />
                <span className={cn("grid size-12 place-items-center rounded-xl", role === r.id ? "bg-warm text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                  <r.icon className="size-6" />
                </span>
                <span>
                  <span className="block font-display text-lg font-bold">{r.label}</span>
                  <span className="block text-sm text-muted-foreground">{r.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={current.defaultName} className="h-12 rounded-xl" autoComplete="given-name" />
          <p className="text-xs text-muted-foreground">Demo sign-in: no password needed.</p>
        </div>
        <Button type="submit" className="h-14 w-full rounded-2xl text-base font-semibold">Continue as {current.label}</Button>
      </form>
    </main>
  );
}
