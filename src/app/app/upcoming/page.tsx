import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";

/** これから。★「予定」だと支払期日の督促感が出る。過去の記録も同じ画面に並ぶ */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SchedulePanel caseId={s.caseId} partyId={s.partyId} />
    </div>
  );
}
