import { NextResponse } from "next/server";
import { loadView } from "@/services/consultation";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const scenarioId = new URL(req.url).searchParams.get("scenarioId");
    return NextResponse.json(await loadView({ caseId, partyId, scenarioId }));
  } catch (e) {
    return errorResponse(e);
  }
}
