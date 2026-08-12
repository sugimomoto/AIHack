import { NextResponse } from "next/server";
import { writeSession } from "@/lib/session";
import { verifyDemoLink } from "@/domain/session/demoLink";
import { asCaseId, asPartyId } from "@/domain/case/types";
import { isDemoCase } from "@/infra-adapters/firestore/repositories/caseRepository";
import { publicUrl } from "@/lib/publicUrl";

/**
 * 継続的に使える確認用リンクから、セッションを発行する。
 *
 * ★確認用と印を付けたケースにしか効かない。
 *   印が無ければ、署名が正しくても発行しない。
 *   **実在の当事者が入っているケースに、リンクで入れるようにしない。**
 *
 * ★印を付けられるのは、運営トークンを持つ人だけである。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const p = verifyDemoLink(token, { key: process.env.DEMO_LINK_SECRET ?? "", now: Date.now() });
  if (!p) return NextResponse.redirect(publicUrl(req, "/?e=link"));

  // ★署名が正しくても、確認用のケースでなければ入れない
  const demo = await isDemoCase(asCaseId(p.caseId)).catch(() => false);
  if (!demo) return NextResponse.redirect(publicUrl(req, "/?e=scope"));

  await writeSession({ partyId: asPartyId(p.partyId), caseId: asCaseId(p.caseId) });
  return NextResponse.redirect(publicUrl(req, "/app"));
}
