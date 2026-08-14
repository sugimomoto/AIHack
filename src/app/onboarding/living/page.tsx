import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { LivingChoice } from "@/components/onboarding/LivingChoice";

export const dynamic = "force-dynamic";

/**
 * I-2 同居
 *
 * ★監護の実態を問うものと読まれかねない問いなので、**用途を限定して明示する。**
 */
export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return (
    <PhoneFrame>
      <LivingChoice caseId={s.caseId} next="/onboarding/children" />
    </PhoneFrame>
  );
}
