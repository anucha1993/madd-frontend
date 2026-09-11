import { ClipboardList } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { ComingSoonCard } from "@/components/layout/PageHeader";

export default function ManifestPage() {
  return (
    <div>
      <PageHeader title="Manifest" description="จัดทำใบนำส่งพัสดุ (Manifest)" />
      <ComingSoonCard icon={ClipboardList} />
    </div>
  );
}
