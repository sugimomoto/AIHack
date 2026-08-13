import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { DocumentPanel } from "@/components/document/DocumentPanel";

/** 公正証書の原案。★合意できた内容だけが入る */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-10">
      <div className="px-5 pt-4">
        <Link href="/app/agreements/notarial" style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
          ← 公正証書
        </Link>
      </div>
      <DocumentPanel caseId={s.caseId} partyId={s.partyId} />
    </div>
  );
}
