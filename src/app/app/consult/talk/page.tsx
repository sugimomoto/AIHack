import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { CaseChat } from "@/components/chat/CaseChat";
import { RevisionSheet } from "@/components/agreement/RevisionSheet";
import { scenarioTitle } from "@/services/scenarioTitle";

/** K-2 対話 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/");
  const { s } = await searchParams;
  const title = await scenarioTitle(s ?? null);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CaseChat
          caseId={session.caseId}
          partyId={session.partyId}
          label={title}
          scenarioId={s ?? null}
          backHref="/app/consult"
        />
      </div>
      {/* ★K-6：相手が変更を申し出ていれば、まずこれに答える */}
      <RevisionSheet caseId={session.caseId} partyId={session.partyId} />
    </>
  );
}
