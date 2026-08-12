import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { CaseChat } from "@/components/chat/CaseChat";
import { RevisionSheet } from "@/components/agreement/RevisionSheet";
import { scenarioTitle, scenarioOutcomes } from "@/services/scenarioTitle";
import { OutcomeCard } from "@/components/consult/OutcomeCard";

/** K-2 対話 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; t?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/");
  const { s, t } = await searchParams;
  const [title, outcomes] = await Promise.all([
    scenarioTitle(s ?? null),
    scenarioOutcomes(s ?? null),
  ]);

  return (
    <>
      {/* ★何が決まるのか分からないまま書かせない */}
      <OutcomeCard outcomes={outcomes} />
      <div className="flex min-h-0 flex-1 flex-col">
        <CaseChat
          caseId={session.caseId}
          partyId={session.partyId}
          label={title}
          scenarioId={s ?? null}
          threadId={t ?? null}
          backHref="/app/consult"
        />
      </div>
      {/* ★K-6：相手が変更を申し出ていれば、まずこれに答える */}
      <RevisionSheet caseId={session.caseId} partyId={session.partyId} />
    </>
  );
}
