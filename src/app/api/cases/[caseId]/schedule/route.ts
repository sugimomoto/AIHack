import { NextResponse } from "next/server";
import { loadSchedule, recordFulfillment } from "@/services/schedule";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const today = new URL(req.url).searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
    return NextResponse.json(await loadSchedule({ caseId, partyId, today }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const { key, kind } = (await req.json()) as { key?: string; kind?: string };
    if (!key || (kind !== "PAID" && kind !== "RECEIVED")) {
      return NextResponse.json({ error: "不正な操作です" }, { status: 400 });
    }
    await recordFulfillment({ caseId, partyId, key, kind });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
