import { NextResponse } from "next/server";
import { computeMetrics } from "@/services/metrics";

/**
 * ★運用の数字。当事者の情報は含まれない。
 *   ログに原文が入っていないため、集計しても何も漏れない（G-F）。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await computeMetrics());
}
