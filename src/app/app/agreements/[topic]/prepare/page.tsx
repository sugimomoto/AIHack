import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { NeedsIntake } from "@/components/agreement/NeedsIntake";
import { asCaseId, asPartyId } from "@/domain/case/types";
import {
  loadForLlm,
  loadIncomeBands,
  loadLiving,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * A-3 途中で伺う
 *
 * ★足りないものだけを並べる。**埋まっているものを聞き直さない。**
 * ★何も足りなければ、入力へ戻す。空の質問画面を見せない。
 */
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const s = await readSession();
  if (!s) redirect("/");

  const { topic: raw } = await params;
  const topic = raw.toUpperCase();
  // ★算定表があるのは養育費だけ。他の論点でこの画面を出さない
  if (topic !== "CHILD_SUPPORT") notFound();

  const back = `/app/agreements/${raw}`;
  const [snap, bands, living] = await Promise.all([
    loadForLlm(asCaseId(s.caseId)).catch(() => null),
    loadIncomeBands(asCaseId(s.caseId)).catch(() => ({}) as Record<string, string>),
    loadLiving(asCaseId(s.caseId)).catch(() => null),
  ]);

  // ★足りないものだけ。埋まっているものを聞き直さない
  const missing: ("CHILDREN" | "LIVING" | "INCOME")[] = [];
  if ((snap?.children.length ?? 0) === 0) missing.push("CHILDREN");
  if (!living) missing.push("LIVING");
  if (!bands[asPartyId(s.partyId)]) missing.push("INCOME");

  if (missing.length === 0) redirect(back);

  return <NeedsIntake caseId={s.caseId} missing={missing} backTo={back} />;
}
