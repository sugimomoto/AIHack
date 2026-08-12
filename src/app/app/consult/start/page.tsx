import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { readSession } from "@/lib/session";
import { threadIdFor } from "@/domain/consultation/thread";
import { listScenarios } from "@/infra-adapters/firestore/repositories/masterRepository";

export const dynamic = "force-dynamic";

/**
 * 相談を始める
 *
 * ★同じトピックを選び直したら、前の会話は出てこない。
 *   「送迎をお願いしたい」を先週やって、今週また頼む。
 *   これは**別の件**であって、続きではない。
 *
 * ★ただし「養育費を決める」は続き。kind がその区別を持っている。
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const session = await readSession();
  if (!session) redirect("/");

  const { s } = await searchParams;
  const sc = s ? (await listScenarios().catch(() => [])).find((x) => x.id === s) : null;

  const threadId = threadIdFor({
    scenarioId: sc?.id ?? null,
    kind: sc?.kind ?? null,
    // ★件ごとに新しくする鍵。続く相談（FORMAL）では使われない。
    //   トピックを選ばずに始めた相談にも渡す（既定のスレッドに入れない）。
    token: randomBytes(6).toString("hex"),
  });

  const q = new URLSearchParams({ t: threadId });
  if (sc?.id) q.set("s", sc.id);
  redirect(`/app/consult/talk?${q.toString()}`);
}
