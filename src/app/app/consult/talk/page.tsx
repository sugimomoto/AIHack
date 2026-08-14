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
import { NOT_NEGOTIABLE_NOTE, canNegotiateAgreement } from "@/domain/consultation/negotiable";
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

      {/* ★★ この文言は、書かれていたのに一度も表示されていなかった。
             このご相談で取り決めが変わらないことを、**書く前に**言う。
             そして「では、どこで変えるのか」の行き先を、同じ場所に置く。
             片方だけだと、行き止まりになる。 */}
      {!negotiable && (
        <div
          className="shrink-0 px-4 pt-3"
        >
          <div
            style={{
              border: "1px dashed var(--border-dashed)",
              borderRadius: "var(--r-md)",
              padding: "11px 13px",
            }}
          >
            <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub-2)" }}>
              {NOT_NEGOTIABLE_NOTE}
            </p>
            <Link
              href="/app/agreements"
              style={{
                fontSize: 12.5,
                color: "var(--text-sub)",
                textDecoration: "underline",
                display: "inline-block",
                marginTop: 6,
                minHeight: 32,
              }}
            >
              取り決めの画面へ
            </Link>
          </div>
        </div>
      )}
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
