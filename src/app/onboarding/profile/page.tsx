import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { IncomeInput } from "@/components/invitation/IncomeInput";
import { loadSituation } from "@/infra-adapters/firestore/repositories/caseRepository";
import { asCaseId } from "@/domain/case/types";
import { nextStepFor, type Situation } from "@/domain/case/situation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/start");

  const situation = ((await loadSituation(asCaseId(s.caseId)).catch(() => null)) ??
    "DIVORCED_NO_TERMS") as Situation;

  return (
    <PhoneFrame>
      <IncomeInput caseId={s.caseId} next={nextStepFor(situation)} />
    </PhoneFrame>
  );
}
