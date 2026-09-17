import { redirect } from "next/navigation";

// Merged into /shipment/list (now the main KPI + shipment list page) — kept as a redirect so
// old bookmarks/links to /dashboard still work.
export default function DashboardPage() {
  redirect("/shipment/list");
}
