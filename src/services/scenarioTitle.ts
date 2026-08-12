import { DEFAULT_TITLE } from "@/domain/consultation/identity";
import { listScenarios } from "@/infra-adapters/firestore/repositories/masterRepository";

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
