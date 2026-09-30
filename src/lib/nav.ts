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
    label: "Shipments",
    icon: Package,
    children: [
      { label: "Drafts", href: "/shipment/draft" },
      { label: "Review Shipment", href: "/shipment/review" },
      { label: "My Pickups", href: "/pickup/list" },
    ],
  },
  {
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
    label: "Reports",
    icon: FileBarChart2,
    children: [
      { label: "Manifest", href: "/manifest" },
      { label: "Shipment Summary", href: "/reports/summary" },
      { label: "Revenue & Expense Report", href: "/reports/finance" },
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
    label: "Management",
    icon: Layers,
    children: [
      { label: "Mark-up Settings", href: "/config/markup" },
      { label: "Add-on Settings", href: "/config/addon" },
      { label: "Insurance UPSC", href: "/config/insurance-caps" },
      { label: "Packaging Supplies", href: "/config/supplies" },
      { label: "Shipment Weight Bands", href: "/config/weight-bands" },
      { label: "Manifest Form Options", href: "/config/manifest-options" },
      { label: "Receipt Line Templates", href: "/config/receipt-line-templates" },
      { label: "Countries", href: "/config/countries" },
    ],
  },
  {
    label: "System Settings",
    icon: Settings,
    children: [
      { label: "Agent Accounts (UPS/DHL)", href: "/config/agent-accounts" },
      { label: "Thai Address Database", href: "/config/thai-address" },
      { label: "Users", href: "/config/users" },
      { label: "Roles & Permissions", href: "/config/roles" },
      { label: "API Integrations", href: "/config/integrations" },
      { label: "Tracking Sync", href: "/config/tracking-sync" },
      { label: "Report Schedules", href: "/config/report-schedules" },
      { label: "SMTP Settings (Gmail)", href: "/config/smtp-settings" },
    ],
  },
];
