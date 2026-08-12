import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return <SettingsView caseId={s.caseId} partyId={s.partyId} />;
}
