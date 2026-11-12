import { createFileRoute } from "@tanstack/react-router";
import { HistoryView } from "@/views/student/HistoryView";

export const Route = createFileRoute("/student/history")({
  head: () => ({
    meta: [
      { title: "Order history — Dequeue" },
      { name: "description", content: "Your past canteen orders, with one-tap reorder." },
      { property: "og:title", content: "Order history — Dequeue" },
      { property: "og:description", content: "Your past canteen orders, with one-tap reorder." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryView,
});
