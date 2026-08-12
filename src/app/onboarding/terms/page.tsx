import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { TermsForm } from "@/components/onboarding/TermsForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/start");
  return (
    <PhoneFrame>
      <TermsForm caseId={s.caseId} />
    </PhoneFrame>
  );
}
