import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { InviteGate } from "@/components/onboarding/InviteGate";

/**
 * B-3 お相手を招待しますか（オンボーディング3枚目）
 *
 * ★セッションが無ければ、まず入口へ。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await readSession())) redirect("/");
  return (
    <PhoneFrame>
      <InviteGate />
    </PhoneFrame>
  );
}
