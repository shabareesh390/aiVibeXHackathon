import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Armchair, History, MapPin, UtensilsCrossed } from "lucide-react";
import { Logo } from "@/components/dq/Logo";
import { NotificationBell } from "@/components/dq/NotificationBell";
import { ThemeToggle } from "@/components/dq/ThemeToggle";
import { useAppReady } from "@/lib/hooks";
import { useSession } from "@/store/sessionStore";

export const Route = createFileRoute("/student")({
  component: StudentLayout,
});

function StudentLayout() {
  useAppReady();
  const lastOrderId = useSession((s) => s.lastOrderId);
  const tabs = [
    { to: "/student/order" as const, label: "Order", icon: UtensilsCrossed },
    { to: "/student/slots" as const, label: "Seats & Slots", icon: Armchair },
  ];
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="Back to role selection">
            <Logo className="text-lg" />
          </Link>
          <nav aria-label="Student Desktop" className="hidden md:flex md:items-center md:gap-1">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                activeProps={{ className: "bg-accent text-accent-foreground font-semibold" }}
              >
                <t.icon className="size-4" />
                {t.label}
              </Link>
            ))}
            {lastOrderId ? (
              <Link
                to="/student/track/$orderId"
                params={{ orderId: lastOrderId }}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                activeProps={{ className: "bg-accent text-accent-foreground font-semibold" }}
              >
                <MapPin className="size-4" />
                Track
              </Link>
            ) : null}
            <Link
              to="/student/history"
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              activeProps={{ className: "bg-accent text-accent-foreground font-semibold" }}
            >
              <History className="size-4" />
              History
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-6">
        <Outlet />
      </main>
      <nav
        aria-label="Student"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {tabs.map((t) => (
            <li key={t.to}>
              <Link
                to={t.to}
                className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                activeProps={{ className: "text-primary" }}
              >
                <t.icon className="size-5" />
                {t.label}
              </Link>
            </li>
          ))}
          <li>
            {lastOrderId ? (
              <Link
                to="/student/track/$orderId"
                params={{ orderId: lastOrderId }}
                className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground"
                activeProps={{ className: "text-primary" }}
              >
                <MapPin className="size-5" />
                Track
              </Link>
            ) : (
              <span
                className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground/50"
                aria-disabled
              >
                <MapPin className="size-5" />
                Track
              </span>
            )}
          </li>
          <li>
            <Link
              to="/student/history"
              className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <History className="size-5" />
              History
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
