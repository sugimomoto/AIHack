import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { DecidedPanel } from "@/components/schedule/DecidedPanel";
import { HouseRules } from "@/components/schedule/HouseRules";

/**
 * 決まったこと
 *
 * ★もとは「これから」。支払日と会う日が並ぶ画面だった。
 *   中身が「これから起きること」から**「決まったことの記録」**に変わったので、
 *   名前も変えた。「これから」のままだと**予定表だと思われる。**
 *
 * ★SchedulePanel は残してある。呼ばないだけ（Issue #7 の土台）。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <DecidedPanel caseId={s.caseId} partyId={s.partyId} />
      {/* ★ずっと続くルール。公正証書には入らない。
             約束（日付つき）とも、今回だけの変更とも別物なので、区分を分ける */}
      <div className="px-5 pb-10">
        <HouseRules caseId={s.caseId} partyId={s.partyId} />
      </div>
    </div>
  );
}
