import LoadingTruck from "@/components/ui/LoadingTruck";

// Shown by Next.js automatically while navigating to any page under this layout
// (e.g. dev-mode route compile time), so switching menus never looks frozen.
export default function AppLoading() {
  return <LoadingTruck fullScreen label="Loading..." />;
}
