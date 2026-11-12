import { createFileRoute } from "@tanstack/react-router";
import { DemandView } from "@/views/manager/DemandView";

export const Route = createFileRoute("/manager/demand")({
  head: () => ({
    meta: [
      { title: "Demand — Dequeue" },
      {
        name: "description",
        content: "Pre-ordered quantities by item and pickup slot, plus queue simulation.",
      },
      { property: "og:title", content: "Demand — Dequeue" },
      {
        property: "og:description",
        content: "Pre-ordered quantities by item and pickup slot, plus queue simulation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemandView,
});
