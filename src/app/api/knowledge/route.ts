import { NextResponse } from "next/server";
import { listKnowledgeArticles } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * ★認証を要求しない。一般情報だからである。
 *   個別の事情に触れないため、誰が読んでも同じ内容になる。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const topic = new URL(req.url).searchParams.get("topic") ?? undefined;
  const items = await listKnowledgeArticles(topic);
  return NextResponse.json({
    items: items.map((a) => ({ id: a.id, title: a.title, summary: a.summary, topics: a.topics })),
  });
}
