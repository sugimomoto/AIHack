import { NextResponse } from "next/server";
import { loadAgreementView, recordConsent } from "@/services/agreement";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const topic = new URL(req.url).searchParams.get("topic") ?? "CHILD_SUPPORT";
    return NextResponse.json(await loadAgreementView({ caseId, partyId, topic }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const { topic, status } = (await req.json()) as { topic?: string; status?: string };
    if (status !== "ACCEPTED" && status !== "REJECTED") {
      return NextResponse.json({ error: "不正な操作です" }, { status: 400 });
    }
    return NextResponse.json(
      await recordConsent({ caseId, partyId, topic: topic ?? "CHILD_SUPPORT", status }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
