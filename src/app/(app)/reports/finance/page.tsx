import { Wallet } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { ComingSoonCard } from "@/components/layout/PageHeader";

export default function ReportFinancePage() {
  return (
    <div>
      <PageHeader title="รายงานรายรับ-รายจ่าย" description="สรุปรายรับ-รายจ่ายจากการขนส่ง" />
      <ComingSoonCard icon={Wallet} />
    </div>
  );
}
