import { createFileRoute } from "@tanstack/react-router";
import { OrderView } from "@/views/student/OrderView";

export const Route = createFileRoute("/student/order")({
  head: () => ({
    meta: [
      { title: "Order food — Dequeue" },
      {
        name: "description",
        content: "Type or say your canteen order in plain language, English or Hinglish.",
      },
      { property: "og:title", content: "Order food — Dequeue" },
      { property: "og:description", content: "Type or say your canteen order in plain language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderView,
});
