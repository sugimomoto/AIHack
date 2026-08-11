import { NextResponse } from "next/server";
import { listScenarios } from "@/infra-adapters/firestore/repositories/masterRepository";

/** ★promptHint は返さない。当事者に見せるものではない */
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listScenarios().catch(() => []);
  return NextResponse.json({
    items: items.map((s) => ({ id: s.id, title: s.title, kind: s.kind, linkedTopic: s.linkedTopic })),
  });
}
