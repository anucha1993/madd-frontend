import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BookOpen,
  Boxes,
  Building2,
  FileBarChart2,
  LayoutDashboard,
  Package,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
} from "lucide-react";

export type NavLeaf = {
  label: string;
  href: string;
};

export type NavItem = {
  // Stable id for a group (its renamed name is stored under it) — never change one.
  id?: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavLeaf[];
};

export const NAV_SECTIONS: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/shipment/list",
  },
  {
    id: "shipments",
    label: "Shipments",
    icon: Package,
    children: [
      { label: "Drafts", href: "/shipment/draft" },
      { label: "My Pickups", href: "/pickup/list" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: Receipt,
    children: [
      { label: "Issue Receipt / Tax Invoice", href: "/billing/receipts/new" },
      { label: "Receipts & Tax Invoices", href: "/billing/receipts" },
      { label: "Tax Invoice Customers", href: "/billing/customers" },
    ],
  },
  {
    id: "supply-sales",
    label: "ขายกล่อง / ซัพพลาย",
    icon: ShoppingCart,
    children: [
      { label: "ขายสินค้า", href: "/supply-sales/new" },
      { label: "รายการขาย", href: "/supply-sales" },
    ],
  },
  {
    label: "Tracking",
    icon: Truck,
    href: "/tracking",
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart2,
    children: [
      { label: "Manifest", href: "/manifest" },
      { label: "Carrier Invoices", href: "/billing/carrier-invoices" },
      { label: "Key Billing Report", href: "/reports/key-billing" },
      { label: "Shipment Analytics", href: "/reports/summary" },
      { label: "Revenue & Expense Report", href: "/reports/finance" },
    ],
  },
  {
    label: "Rate Book",
    icon: BookOpen,
    href: "/reports/rate-book",
  },
  {
    label: "Branches",
    icon: Building2,
    href: "/branch",
  },
  {
    label: "Customers",
    icon: Users,
    href: "/customer",
  },
  // Branch staff count / receive stock here — a menu of its own, not buried under Management.
  {
    label: "Packaging Stock",
    icon: Boxes,
    href: "/config/supplies/stock",
  },
  {
    id: "general",
    label: "General Setting",
    icon: SlidersHorizontal,
    children: [
      { label: "Customer Display", href: "/config/customer-display" },
      { label: "UPSC Lane Limit", href: "/config/insurance-caps" },
      { label: "Code & Display Name", href: "/config/charge-names" },
      { label: "Weight Range for Report", href: "/config/weight-bands" },
      { label: "Manifest for Report", href: "/config/manifest-options" },
      { label: "Tax Invoice Template", href: "/config/receipt-line-templates" },
      { label: "Zone & Country List", href: "/config/countries" },
    ],
  },
  {
    id: "pricing",
    label: "Price Setting",
    icon: BadgeDollarSign,
    children: [
      { label: "Mark up by Account", href: "/config/markup" },
      { label: "Weight Range Mark up", href: "/config/weight-markups" },
      { label: "Heavy Weight Mark up", href: "/config/heavy-rates" },
      { label: "Account & Bypass", href: "/config/agent-accounts" },
    ],
  },
  // Add-ons and the packaging sold with them (cartons / metal boxes) — one topic, one menu.
  {
    id: "addon",
    label: "Add-on Setting",
    icon: PackagePlus,
    children: [
      { label: "Add-on Setting", href: "/config/addon" },
      { label: "Carton & Metal Setting", href: "/config/supplies" },
    ],
  },
  {
    id: "settings",
    label: "System Settings",
    icon: Settings,
    children: [
      { label: "Shipment Required Fields", href: "/config/shipment-fields" },
      { label: "Thai Address Database", href: "/config/thai-address" },
      { label: "Users", href: "/config/users" },
      { label: "Roles & Permissions", href: "/config/roles" },
      { label: "Audit Log", href: "/config/audit-logs" },
      { label: "System Alerts", href: "/config/system-alerts" },
      { label: "Public API (Website)", href: "/config/api-clients" },
      { label: "API Integrations", href: "/config/integrations" },
      { label: "Tracking Sync", href: "/config/tracking-sync" },
      { label: "Report Schedules", href: "/config/report-schedules" },
      { label: "SMTP Settings (Gmail)", href: "/config/smtp-settings" },
    ],
  },
];
