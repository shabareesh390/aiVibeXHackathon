import { createFileRoute } from "@tanstack/react-router";
import { SlotsView } from "@/views/student/SlotsView";

export const Route = createFileRoute("/student/slots")({
  head: () => ({
    meta: [
      { title: "Pick a pickup slot — Dequeue" },
      {
        name: "description",
        content: "Pickup slots based on real kitchen capacity, colour-coded by how busy they are.",
      },
      { property: "og:title", content: "Pick a pickup slot — Dequeue" },
      { property: "og:description", content: "Pickup slots based on real kitchen capacity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SlotsView,
});
