import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { QuietCard } from "@/components/safety/QuietCard";
import { InviteCard } from "@/components/onboarding/InviteCard";
import { IncomeCard } from "@/components/onboarding/IncomeCard";
import { HomeBoard } from "@/components/home/HomeBoard";
import { asCaseId, asPartyId } from "@/domain/case/types";
import {
  hasPendingSafetyEvent,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ホーム
 *
 * ★起動直後に見る画面。**用がなければ何もしなくてよい。**
 *   件数は文言に埋め込む。バッジは使わない（U-5）。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  // ★検知したときのみ、次に開いたときに1枚（案3）。
  //   書いた直後には出さない。出すと「見抜かれた」になる。
  const quiet = await hasPendingSafetyEvent(asPartyId(s.partyId)).catch(() => false);

  const snap = await loadForLlm(asCaseId(s.caseId)).catch(() => null);

  // ★招待はオンボーディングから外した。お相手がまだ加わっていないときだけ置く。
  //   まだ加わっていないことを、遅れとして書かない。
  const alone = snap?.parties.some((p) => p.id !== s.partyId && p.state === "PREPARING") ?? false;

  // ★年収をオンボーディングから外した結果、受諾した側は入れる経路を持たない（H-2）。
  const needsIncome = snap?.parties.some((p) => p.id === s.partyId && !p.incomeBand) ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {quiet && <QuietCard />}
      <HomeBoard caseId={s.caseId} partyId={s.partyId} />
      {alone && <InviteCard />}
      {needsIncome && <IncomeCard />}
      <div className="h-4 shrink-0" />
    </div>
  );
}
