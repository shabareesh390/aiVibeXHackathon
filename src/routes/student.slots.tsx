import { createFileRoute } from "@tanstack/react-router";
import { SlotsView } from "@/views/student/SlotsView";

export const Route = createFileRoute("/student/slots")({
  head: () => ({
    meta: [
      { title: "Available Seats & Slots — Dequeue" },
      {
        name: "description",
        content: "Canteen available seats and pickup capacity, showing free seats in real-time.",
      },
      { property: "og:title", content: "Available Seats & Slots — Dequeue" },
      { property: "og:description", content: "Canteen available seats and pickup capacity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SlotsView,
});
