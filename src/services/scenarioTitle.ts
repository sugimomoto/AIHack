import { DEFAULT_TITLE } from "@/domain/consultation/thread";
import {
  findPublishedPayloadSchema,
  listScenarios,
} from "@/infra-adapters/firestore/repositories/masterRepository";
import { outcomesOf, type Outcome } from "@/domain/agreement/outcome";

/** ★題はマスタから引く。画面に直書きしない */
export async function scenarioTitle(scenarioId: string | null): Promise<string> {
  if (!scenarioId) return DEFAULT_TITLE;
  try {
    const all = await listScenarios();
    return all.find((s) => s.id === scenarioId)?.title ?? DEFAULT_TITLE;
  } catch {
    return DEFAULT_TITLE;
  }
}

/**
 * この相談で決まること。
 *
 * ★シナリオに論点が紐づいていなければ、何も出さない。
 *   決まらないものを「決まる」と書かない。
 */
export async function scenarioOutcomes(scenarioId: string | null): Promise<Outcome[]> {
  if (!scenarioId) return [];
  try {
    const sc = (await listScenarios()).find((s) => s.id === scenarioId);
    if (!sc?.linkedTopic) return [];
    const master = await findPublishedPayloadSchema(sc.linkedTopic);
    return outcomesOf(master?.schema as never);
  } catch {
    return [];
  }
}

/** シナリオの種別。★取り決めを動かしてよいかの判定に使う */
export async function scenarioKind(scenarioId: string | null): Promise<string | null> {
  if (!scenarioId) return null;
  try {
    return (await listScenarios()).find((s) => s.id === scenarioId)?.kind ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
