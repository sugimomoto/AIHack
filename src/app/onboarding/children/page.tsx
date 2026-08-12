import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { ChildrenForm } from "@/components/onboarding/ChildrenForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/start");

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-8">
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>お子さんのこと</h1>
        <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
          養育費の目安をお出しするために伺います。お相手には、お子さんの人数と年齢の区分だけが共有されます。
        </p>
        <ChildrenForm caseId={s.caseId} next="/onboarding/profile" />
      </div>
    </PhoneFrame>
  );
}
