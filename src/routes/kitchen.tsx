import { createFileRoute } from "@tanstack/react-router";
import { KitchenView } from "@/views/kitchen/KitchenView";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen plan — Dequeue" },
      {
        name: "description",
        content: "Batched, time-sequenced cooking plan for the canteen kitchen tablet.",
      },
      { property: "og:title", content: "Kitchen plan — Dequeue" },
      {
        property: "og:description",
        content: "Batched, time-sequenced cooking plan for the canteen kitchen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitchenView,
});
