import { FileBarChart2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { ComingSoonCard } from "@/components/layout/PageHeader";

export default function ReportSummaryPage() {
  return (
    <div>
      <PageHeader title="สรุปยอดขนส่ง" description="รายงานสรุปยอดขนส่งรายวัน / รายเดือน" />
      <ComingSoonCard icon={FileBarChart2} />
    </div>
  );
}
