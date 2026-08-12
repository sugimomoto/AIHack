import { NextResponse } from "next/server";
import { listSupportResources } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * ★認証を要求しない。**誰が見たかを記録しない。**
 *
 *   窓口を見たこと自体が、その人の状況を示してしまう。
 *   常設であり、検知に反応しない（案2）。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listSupportResources().catch(() => []);
  return NextResponse.json({ items });
}
