import { createFileRoute } from "@tanstack/react-router";
import { ScanView } from "@/views/manager/ScanView";

export const Route = createFileRoute("/manager/scan")({
  head: () => ({
    meta: [
      { title: "Scan & Handover — Dequeue" },
      {
        name: "description",
        content: "Scan student order QR codes to verify and hand over food at the canteen pickup counter.",
      },
      { property: "og:title", content: "Scan & Handover — Dequeue" },
      {
        property: "og:description",
        content: "Scan student order QR codes to verify and hand over food at the canteen pickup counter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanView,
});
