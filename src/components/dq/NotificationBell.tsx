import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppStore } from "@/store/appStore";
import { markNotificationsRead } from "@/services/orderService";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const notifications = useAppStore((s) => s.notifications);
  const orders = useAppStore((s) => s.orders);
  const mine = notifications.filter((n) => !n.orderId || orders.find((o) => o.id === n.orderId)?.mine);
  const unread = mine.filter((n) => !n.read).length;
  return (
    <Popover onOpenChange={(open) => !open && unread && markNotificationsRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`}>
          <Bell />
          {unread > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0">
        <p className="border-b px-4 py-3 font-display font-semibold">Notifications</p>
        <ul className="max-h-80 overflow-y-auto">
          {mine.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet. We'll ping you when your food is ready.</li>}
          {mine.map((n) => (
            <li key={n.id} className="border-b px-4 py-3 last:border-0">
              <div className="flex items-start gap-2">
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                <div>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(n.at, { addSuffix: true })}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
