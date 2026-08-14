import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { IncomeInput } from "@/components/invitation/IncomeInput";
import { loadSituation } from "@/infra-adapters/firestore/repositories/caseRepository";
import { asCaseId } from "@/domain/case/types";
import { nextStepFor, parseSituation } from "@/domain/case/situation";

export const dynamic = "force-dynamic";

/**
 * I-4 年収
 *
 * ★飛ばせる画面なので、進捗バーを出さない。
 *   飛ばせるものを進捗に数えると、飛ばしづらくなる。
 *
 * ★飛ばした先は、入力した先と同じ。**飛ばしても行き止まりにしない。**
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const s = await readSession();
  if (!s) redirect("/");

  // ★ホームから開いた人は、ホームに戻す。
  //   状況で分岐するのはオンボーディングを通っている最中だけである。
  const { from } = await searchParams;
  const situation =
    parseSituation(await loadSituation(asCaseId(s.caseId)).catch(() => null)) ?? "DIVORCED_NO_TERMS";
  const next = from === "home" ? "/app" : nextStepFor(situation);

  return (
    <PhoneFrame>
      <IncomeInput caseId={s.caseId} next={next} skip={next} />
    </PhoneFrame>
  );
}
