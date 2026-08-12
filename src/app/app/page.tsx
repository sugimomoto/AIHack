import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { CaseChat } from "@/components/chat/CaseChat";
import { AgreementPanel } from "@/components/agreement/AgreementPanel";
import { RevisionSheet } from "@/components/agreement/RevisionSheet";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
import { DocumentPanel } from "@/components/document/DocumentPanel";
import { QuietCard } from "@/components/safety/QuietCard";
import { InviteCard } from "@/components/onboarding/InviteCard";
import { IncomeCard } from "@/components/onboarding/IncomeCard";

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

  // ★検知したときのみ、次に開いたときに1枚（案3）。
  //   書いた直後には出さない。出すと「見抜かれた」になる。
  const { hasPendingSafetyEvent } = await import(
    "@/infra-adapters/firestore/repositories/caseRepository"
  );
  const { asPartyId } = await import("@/domain/case/types");
  const quiet = await hasPendingSafetyEvent(asPartyId(s.partyId)).catch(() => false);

  // ★招待はオンボーディングから外した。お相手がまだ加わっていないときだけ、ここに置く。
  //   まだ加わっていないことを、遅れとして書かない。
  const { loadForLlm } = await import("@/infra-adapters/firestore/repositories/caseRepository");
  const { asCaseId } = await import("@/domain/case/types");
  const snap = await loadForLlm(asCaseId(s.caseId)).catch(() => null);
  const alone = snap?.parties.some((p) => p.id !== s.partyId && p.state === "PREPARING") ?? false;

  // ★年収をオンボーディングから外した結果、受諾した側は入れる経路を持たない。
  //   算定表は双方の年収で引くので、**入れる場所自体は要る。**
  //   ただし通り道には置かない（H-2）。
  const needsIncome = snap?.parties.some((p) => p.id === s.partyId && !p.incomeBand) ?? false;

  return (
    <PhoneFrame>
      {quiet && <QuietCard />}
      {alone && <InviteCard />}
      {needsIncome && <IncomeCard />}
      <div className="flex min-h-0 flex-1 flex-col">
        <CaseChat caseId={s.caseId} partyId={s.partyId} label="相談" />
      </div>
      {/* ★K-6：相手が変更を申し出ていれば、まずこれに答える */}
      <RevisionSheet caseId={s.caseId} partyId={s.partyId} />

      {/* ★3つまとめて、ここで高さを持つ。
             パネルごとに上限（42%＋36%＋38%）を持たせていたため合計が枠を超え、
             **対話の高さが 0 になっていた。**対話を押し出さないことが要件である。 */}
      <div className="shrink-0 overflow-y-auto" style={{ maxHeight: "52%" }}>
        <AgreementPanel caseId={s.caseId} partyId={s.partyId} />
        <SchedulePanel caseId={s.caseId} partyId={s.partyId} />
        <DocumentPanel caseId={s.caseId} partyId={s.partyId} />
      </div>
    </PhoneFrame>
  );
}
