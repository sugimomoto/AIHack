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
  if (!s) redirect("/");

  // ★名前は載せない。共有される情報ではない
  const births = await loadChildBirthDates(asCaseId(s.caseId)).catch(() => []);

  // ★★ 招待した側がまだ登録していなければ、**何も聞かずにアプリへ入れる。**
  //
  //   以前はここで /onboarding/children（登録）へ送っていた。
  //   だが取り決めの入力を「必要になった時点で伺う」形にしたとき、
  //   **招待した側の入口からは、お子さんの登録を外した。**
  //   招待された側だけに残っていると、
  //   **受諾直後のいちばん抵抗の大きい瞬間に、登録を求めることになる。**
  //
  //   お子さんのことは、養育費を入れようとした時点で伺う（A-3）。
  if (births.length === 0) redirect("/app");

  return (
    <PhoneFrame>
      <ConfirmChildren caseId={s.caseId} births={births} next="/app" />
    </PhoneFrame>
  );
}
