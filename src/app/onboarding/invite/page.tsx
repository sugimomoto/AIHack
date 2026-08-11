import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { InviteCreate } from "@/components/invitation/InviteCreate";

/** ★セッションが無ければ、まず開始する */
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await readSession())) redirect("/start");
  return (
    <PhoneFrame>
      <InviteCreate />
    </PhoneFrame>
  );
}
