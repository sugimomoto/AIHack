import { NextResponse } from "next/server";
import { buildCaseDocument } from "@/services/document";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    return NextResponse.json(await buildCaseDocument({ caseId, partyId }));
  } catch (e) {
    return errorResponse(e);
  }
}
