import LoadingTruck from "./LoadingTruck";

// Default page-level loading state — used by every config/list page so the
// loading indicator is visually consistent everywhere, not just one page.
export default function PageLoading({ label = "กำลังโหลดข้อมูล..." }: { label?: string }) {
  return (
    <div className="relative flex min-h-[360px] items-center justify-center">
      <LoadingTruck fullScreen label={label} />
    </div>
  );
}
