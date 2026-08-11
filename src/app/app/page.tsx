import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { CaseChat } from "@/components/chat/CaseChat";
import { AgreementPanel } from "@/components/agreement/AgreementPanel";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
import { DocumentPanel } from "@/components/document/DocumentPanel";

/**
 * アプリ本体
 *
 * ★セッションが無ければ入れない。
 *   セッションは招待の受諾でしか発行されない。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  return (
    <PhoneFrame>
      <div className="flex min-h-0 flex-1 flex-col">
        <CaseChat caseId={s.caseId} partyId={s.partyId} label="相談" />
      </div>
      <AgreementPanel caseId={s.caseId} partyId={s.partyId} />
      <SchedulePanel caseId={s.caseId} partyId={s.partyId} />
      <DocumentPanel caseId={s.caseId} partyId={s.partyId} />
    </PhoneFrame>
  );
}
