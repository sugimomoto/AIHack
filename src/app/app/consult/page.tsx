import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { CaseChat } from "@/components/chat/CaseChat";
import { RevisionSheet } from "@/components/agreement/RevisionSheet";

/** 相談。★「対話」より一人称的で、相手と話す含みがない */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CaseChat caseId={s.caseId} partyId={s.partyId} label="相談" />
      </div>
      {/* ★K-6：相手が変更を申し出ていれば、まずこれに答える */}
      <RevisionSheet caseId={s.caseId} partyId={s.partyId} />
    </>
  );
}
