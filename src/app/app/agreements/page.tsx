import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { TopicList } from "@/components/agreement/TopicList";
import { IMPLEMENTED_TOPICS } from "@/domain/agreement/topics";
import { screenStateOf, type ScreenState } from "@/domain/agreement/screen";
import { loadAgreementView } from "@/services/agreement";
import { asPartyId } from "@/domain/case/types";

/**
 * 取り決め（A-1）
 *
 * ★4つの論点を並べる。「合意」は成立を前提とした語なので、見出しには使わない。
 * ★状態はサーバで引く。**下書きは、この時点で相手側からは落ちている**
 *   （loadAgreementView が isVisibleTo で落とす）。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  const entries = await Promise.all(
    IMPLEMENTED_TOPICS.map(async (topic) => {
      const v = await loadAgreementView({ caseId: s.caseId, partyId: asPartyId(s.partyId), topic }).catch(
        () => null,
      );
      const state: ScreenState = v
        ? screenStateOf({
            agreed: v.agreement !== null,
            ownPayload: v.ownPayload,
            otherPayload: v.otherPayload,
            sharing: v.sharing,
          })
        : "EMPTY";
      return [topic, state] as const;
    }),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <TopicList states={Object.fromEntries(entries)} />
    </div>
  );
}
