import { createFileRoute } from "@tanstack/react-router";
import { TrackView } from "@/views/student/TrackView";

export const Route = createFileRoute("/student/track/$orderId")({
  head: () => ({ meta: [
    { title: "Track your order — Dequeue" },
    { name: "description", content: "Live status, countdown and pickup shelf for your canteen order." },
    { property: "og:title", content: "Track your order — Dequeue" },
    { property: "og:description", content: "Live status and pickup shelf for your canteen order." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: function TrackRoute() {
    const { orderId } = Route.useParams();
    return <TrackView orderId={orderId} />;
  },
});
