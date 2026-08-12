import { NextResponse } from "next/server";
import {
  listScenarios,
  listTopicCategories,
} from "@/infra-adapters/firestore/repositories/masterRepository";

/** ★promptHint は返さない。当事者に見せるものではない */
export const dynamic = "force-dynamic";

export async function GET() {
  const [items, categories] = await Promise.all([
    listScenarios().catch(() => []),
    listTopicCategories().catch(() => []),
  ]);
  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      categoryId: s.categoryId ?? null,
      linkedTopic: s.linkedTopic,
    })),
    categories,
  });
}
