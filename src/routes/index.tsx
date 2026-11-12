import { createFileRoute } from "@tanstack/react-router";
import { RoleSelect } from "@/views/RoleSelect";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dequeue — Sign in to your canteen" },
      { name: "description", content: "Choose Student, Kitchen or Manager to start using Dequeue, the campus canteen pre-order system." },
      { property: "og:title", content: "Dequeue — Sign in to your canteen" },
      { property: "og:description", content: "Pre-order canteen food with pickup slots based on real kitchen capacity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoleSelect,
});
