import type { LlmCallLog } from "@/domain/llm/callLog";
import { getDb } from "../client";

/**
 * LLM 呼び出しの記録
 *
 * ★保存するのは toCallLog が絞り込んだ形のみ。
 *   prompt / completion はこの型に存在しないため、書きようがない。
 *
 * ★記録の失敗で対話を止めない。
 *   コスト計測はプロダクトの本体ではない。
 */
export async function saveCallLog(log: LlmCallLog): Promise<void> {
  try {
    await getDb().collection("llmCallLogs").add(log);
  } catch (e) {
    console.warn("[llm] 呼び出しログの保存に失敗しました", e);
  }
}

/** CT-1〜CT-4 の集計用 */
/** ★上限を置く。全件スキャンを外から無制限に起こさせない */
export const CALL_LOG_SCAN_LIMIT = 2000;

export async function listCallLogs(caseId?: string): Promise<LlmCallLog[]> {
  const col = getDb().collection("llmCallLogs");
  const q = caseId ? col.where("caseId", "==", caseId) : col;
  const snap = await q.limit(CALL_LOG_SCAN_LIMIT).get();
  return snap.docs.map((d) => d.data() as LlmCallLog);
}

/** 検証用。★確認スクリプトが前回の記録を巻き込まないようにする */
export async function deleteCallLogs(caseId: string): Promise<number> {
  const snap = await getDb().collection("llmCallLogs").where("caseId", "==", caseId).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
  return snap.size;
}
