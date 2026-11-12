import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard, RotateCcw, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/dq/Logo";
import { ThemeToggle } from "@/components/dq/ThemeToggle";
import { useAppReady } from "@/lib/hooks";
import { resetDemoData } from "@/store/appStore";
import { useSession } from "@/store/sessionStore";

export const Route = createFileRoute("/manager")({ component: ManagerLayout });

const NAV = [
  { to: "/manager/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/manager/menu" as const, label: "Menu", icon: UtensilsCrossed },
  { to: "/manager/demand" as const, label: "Demand", icon: BarChart3 },
];

function ManagerLayout() {
  useAppReady();
  const user = useSession((s) => s.user);
  return (
    <div className="min-h-screen bg-surface md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:p-5">
        <Link to="/" aria-label="Back to role selection">
          <Logo />
        </Link>
        <nav aria-label="Manager" className="flex gap-1 md:mt-8 md:flex-col">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring"
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
              }}
            >
              <n.icon className="size-4" />
              <span className="hidden sm:inline">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="hidden md:mt-auto md:block md:space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => {
              resetDemoData();
              toast.success("Demo data reset");
            }}
          >
            <RotateCcw />
            Reset demo data
          </Button>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{user?.name ?? "Manager"}</p>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
