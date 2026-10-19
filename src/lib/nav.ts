import type { LucideIcon } from "lucide-react";
import {
  Building2,
  FileBarChart2,
  LayoutDashboard,
  Layers,
  Package,
  Receipt,
  Settings,
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
      { label: "Rate Book", href: "/reports/rate-book" },
    ],
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
  {
    id: "management",
    label: "Management",
    icon: Layers,
    children: [
      { label: "Mark-up Settings", href: "/config/markup" },
      { label: "Weight Markup", href: "/config/weight-markups" },
      { label: "Heavy Weight Rate", href: "/config/heavy-rates" },
      { label: "Customer Display", href: "/config/customer-display" },
      { label: "Charge Display Names", href: "/config/charge-names" },
      { label: "Add-on Settings", href: "/config/addon" },
      { label: "Insurance UPSC", href: "/config/insurance-caps" },
      { label: "Packaging Supplies", href: "/config/supplies" },
      { label: "Packaging Stock", href: "/config/supplies/stock" },
      { label: "Shipment Weight Bands", href: "/config/weight-bands" },
      { label: "Manifest Form Options", href: "/config/manifest-options" },
      { label: "Receipt Line Templates", href: "/config/receipt-line-templates" },
      { label: "Countries", href: "/config/countries" },
    ],
  },
  {
    id: "settings",
    label: "System Settings",
    icon: Settings,
    children: [
      { label: "Agent Accounts (UPS/DHL)", href: "/config/agent-accounts" },
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
