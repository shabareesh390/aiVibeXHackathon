import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/views/manager/DashboardView";

export const Route = createFileRoute("/manager/dashboard")({
  head: () => ({
    meta: [
      { title: "Manager dashboard — Dequeue" },
      {
        name: "description",
        content: "Orders, wait times, slot utilization and kitchen load at a glance.",
      },
      { property: "og:title", content: "Manager dashboard — Dequeue" },
      {
        property: "og:description",
        content: "Orders, wait times, slot utilization and kitchen load at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardView,
});
