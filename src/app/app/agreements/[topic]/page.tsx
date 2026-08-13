import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { TopicScreen } from "@/components/agreement/TopicScreen";
import { IMPLEMENTED_TOPICS } from "@/domain/agreement/topics";

/**
 * 論点ごとの画面（A-2）
 *
 * ★扱えない論点は 404。**入口に出していないものは、URL でも開けない。**
 */
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const s = await readSession();
  if (!s) redirect("/");

  const { topic: raw } = await params;
  const topic = raw.toUpperCase();
  if (!(IMPLEMENTED_TOPICS as readonly string[]).includes(topic)) notFound();

  return <TopicScreen caseId={s.caseId} partyId={s.partyId} topic={topic} />;
}
