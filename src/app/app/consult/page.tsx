import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { ConsultList } from "@/components/consult/ConsultList";

/**
 * K-1 相談の一覧
 *
 * ★相談タブは対話に直行しない。**一覧に着地する。**
 *   「養育費」「面会の日程」「塾の費用」が同時に進む。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return <ConsultList caseId={s.caseId} partyId={s.partyId} />;
}
