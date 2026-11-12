import { createFileRoute } from "@tanstack/react-router";
import { MenuView } from "@/views/manager/MenuView";

export const Route = createFileRoute("/manager/menu")({
  head: () => ({
    meta: [
      { title: "Menu & stations — Dequeue" },
      {
        name: "description",
        content: "Edit prices, availability and how each item maps to a kitchen station.",
      },
      { property: "og:title", content: "Menu & stations — Dequeue" },
      {
        property: "og:description",
        content: "Edit prices, availability and how each item maps to a kitchen station.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuView,
});
