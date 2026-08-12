import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { AgreementPanel } from "@/components/agreement/AgreementPanel";
import { DocumentPanel } from "@/components/document/DocumentPanel";
import { EmptyAgreements } from "@/components/agreement/EmptyAgreements";
import { IMPLEMENTED_TOPICS } from "@/domain/agreement/topics";
import { asCaseId } from "@/domain/case/types";
import { loadForLlm } from "@/infra-adapters/firestore/repositories/caseRepository";

/** 取り決め。★「合意」は成立を前提とした語。係争中の項目に使うと嘘になる */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  const snap = await loadForLlm(asCaseId(s.caseId)).catch(() => null);

  // ★何も始まっていないうちは、空の枠を並べない（L-2）。
  //   「未着手」を並べると宿題の一覧になる。
  const started =
    (snap?.proposals.length ?? 0) > 0 ||
    (snap?.agreementItems.some((a) => a.status !== "NOT_STARTED") ?? false);

  if (!started) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <EmptyAgreements />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* ★養育費だけを出していた。**面会交流には画面が一つも無かった。**
             片方だけを扱う画面は、それ自体が立場を作る（→ Issue #5） */}
      {IMPLEMENTED_TOPICS.map((t) => (
        <AgreementPanel key={t} caseId={s.caseId} partyId={s.partyId} topic={t} />
      ))}
      <DocumentPanel caseId={s.caseId} partyId={s.partyId} />
    </div>
  );
}
