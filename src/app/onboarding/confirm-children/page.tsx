import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { ConfirmChildren } from "@/components/onboarding/ConfirmChildren";
import { loadChildBirthDates } from "@/infra-adapters/firestore/repositories/caseRepository";
import { asCaseId } from "@/domain/case/types";

export const dynamic = "force-dynamic";

/**
 * H-1 受諾直後（うかがうのは、この1枚だけ）
 *
 * ★年収はここで聞かない。お金の話題で目安が要る場面になってから、対話の中でうかがう。
 * ★ご事情も、お住まいも、同居も聞かない。
 */
export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/start");

  // ★名前は載せない。共有される情報ではない
  const births = await loadChildBirthDates(asCaseId(s.caseId)).catch(() => []);

  // ★招待した側がまだ登録していなければ、確認ではなく登録になる
  if (births.length === 0) redirect("/onboarding/children");

  return (
    <PhoneFrame>
      <ConfirmChildren caseId={s.caseId} births={births} next="/app" />
    </PhoneFrame>
  );
}
