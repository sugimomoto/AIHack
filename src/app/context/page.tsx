import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { ContextView } from "@/components/security/ContextView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/start");
  return (
    <PhoneFrame>
      <ContextView caseId={s.caseId} partyId={s.partyId} />
    </PhoneFrame>
  );
}
