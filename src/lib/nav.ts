import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  Layers,
  Package,
  Settings,
  Truck,
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
    href: "/dashboard",
  },
  {
    label: "Shipments",
    icon: Package,
    children: [
      { label: "Create Shipment", href: "/shipment/create" },
      { label: "My Shipments", href: "/shipment/list" },
      { label: "Review Shipment", href: "/shipment/review" },
    ],
  },
  {
    label: "Manifest",
    icon: ClipboardList,
    href: "/manifest",
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
    label: "Management",
    icon: Layers,
    children: [
      { label: "Mark-up Settings", href: "/config/markup" },
      { label: "Add-on Settings", href: "/config/addon" },
      { label: "Insurance Country Caps", href: "/config/insurance-caps" },
      { label: "Packaging Supplies", href: "/config/supplies" },
      { label: "Shipment Weight Bands", href: "/config/weight-bands" },
      { label: "Countries", href: "/config/countries" },
    ],
  },
  {
    label: "System Settings",
    icon: Settings,
    children: [
      { label: "Agent Accounts (UPS/DHL)", href: "/config/agent-accounts" },
      { label: "Thai Address Database", href: "/config/thai-address" },
      { label: "Users & Permissions", href: "/config/users" },
      { label: "API Integrations", href: "/config/integrations" },
    ],
  },
];
