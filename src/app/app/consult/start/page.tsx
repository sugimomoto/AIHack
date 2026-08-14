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
 * ★★ 例外は無くした（2026-08-14）。以前は「養育費を決める」だけが続きだった。
 *   対話から取り決めへ行く経路を断った以上、相談は都度のものである。
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const session = await readSession();
  if (!session) redirect("/");

  const { s } = await searchParams;
  const sc = s ? (await listScenarios().catch(() => [])).find((x) => x.id === s) : null;

  const threadId = threadIdFor({
    scenarioId: sc?.id ?? null,
    // ★件ごとに新しくする鍵。トピックを選ばずに始めた相談にも渡す
    token: randomBytes(6).toString("hex"),
  });

  const q = new URLSearchParams({ t: threadId });
  if (sc?.id) q.set("s", sc.id);
  redirect(`/app/consult/talk?${q.toString()}`);
}
