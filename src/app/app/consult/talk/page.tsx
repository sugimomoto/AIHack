import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { CaseChat } from "@/components/chat/CaseChat";
import { RevisionSheet } from "@/components/agreement/RevisionSheet";
import {
  scenarioTitle,
  scenarioOutcomes,
  scenarioKind,
  scenarioOpening,
} from "@/services/scenarioTitle";
import { OutcomeCard } from "@/components/consult/OutcomeCard";
import { AdjustmentPanel } from "@/components/consult/AdjustmentPanel";
import { canNegotiateAgreement } from "@/domain/consultation/negotiable";
import Link from "next/link";
import { parseThreadId } from "@/domain/consultation/thread";

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
  const [title, kind, guide] = await Promise.all([
    scenarioTitle(s ?? null),
    scenarioKind(s ?? null),
    scenarioOpening(s ?? null),
  ]);
  // ★取り決めを動かさない相談で「この相談で決まること」に
  //   養育費のスキーマ（月額・支払日・終期）を出していた。
  //   決まらないものを、決まるように見せない。
  const negotiable = canNegotiateAgreement(kind);
  const outcomes = negotiable ? await scenarioOutcomes(s ?? null) : [];

  return (
    <>
      {/* ★何が決まるのか分からないまま書かせない */}
      <OutcomeCard outcomes={outcomes} />

      {/* ★★ 「このご相談では、いまの取り決めは変わりません」を外した（2026-08-14）。
             `FORMAL` が 0 になり、**トピックを選んだ相談すべてに出るようになった。**
             ★どれにも出る注意書きは、区別をしない。区別しないものは、注意にならない。

             しかも書く前に、画面のいちばん上に出ていた。
             **まだ誰も尋ねていないことへの答え**が、最初に来ていた。

             ★同じことは、下の「お話し合いの内容」が言う。
             そちらは**控えが実際にできたときだけ**出るので、
             「これは取り決めになるのか」という問いが立つ場面と一致する。 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <CaseChat
          caseId={session.caseId}
          partyId={session.partyId}
          label={title}
          scenarioId={s ?? null}
          threadId={t ?? null}
          opening={guide.opening}
          examples={guide.examples}
          backHref="/app/consult"
        />
      </div>
      {/* ★ADJUSTMENT の帰結。公正証書には載らない */}
      {!negotiable && (
        <AdjustmentPanel
          caseId={session.caseId}
          partyId={session.partyId}
          threadId={parseThreadId(t ?? null)}
        />
      )}

      {/* ★K-6：相手が変更を申し出ていれば、まずこれに答える */}
      <RevisionSheet caseId={session.caseId} partyId={session.partyId} />
    </>
  );
}
