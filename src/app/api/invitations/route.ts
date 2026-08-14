import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { UnauthenticatedError } from "@/lib/auth";
import { loadForLlm } from "@/infra-adapters/firestore/repositories/caseRepository";
import { assertOwnParty, ScopeViolationError } from "@/domain/case/scope";
import { asCaseId, type PartyId } from "@/domain/case/types";
import { buildInvitationMail } from "@/domain/invitation/mail";
import { expiresAt, generateInvitationToken } from "@/domain/invitation/token";
import type { InvitationMethod, InvitationRecord } from "@/domain/invitation/types";
import { INVITATION_METHODS } from "@/domain/invitation/types";
import { saveInvitation } from "@/infra-adapters/firestore/repositories/invitationRepository";

/**
 * 招待の作成
 *
 * ★再送のAPIは存在しない（AC-09）。
 *   催促は圧迫になる。作れてしまうと、いずれ使われる。
 *
 * ★本文を受け取らない。
 *   当事者が自由文を書けないため、この経路で罵倒や脅迫を送れない。
 */

export async function POST(req: Request) {
  let partyId: PartyId;
  let caseId: string;
  let senderName: string;
  try {
    partyId = await resolveParty(req);
    // ★当事者であることを確かめてから招待を作る
    const { readSession } = await import("@/lib/session");
    const s = await readSession();
    caseId = s?.caseId ?? "";
    if (!caseId) throw new UnauthenticatedError();
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);
    // ★★ 既定を `displayNameForOther` から外した（2026-08-14）。
    //
    //   これは「お相手にどう表示するか」の欄で、**既定値が「お相手」**である。
    //   そのため名前を空欄にすると、招待を開いた画面に
    //   **「お相手さまからのご依頼です。」**と出ていた。意味をなさない。
    //
    //   ★画面は「空欄なら『ご関係の方』となります」と約束している。
    //   **書いてあるとおりにする。**
    senderName = "ご関係の方";
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ScopeViolationError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = (await req.json()) as {
    method?: string;
    recipientEmail?: string;
    revealSenderName?: boolean;
    senderName?: string;
  };

  const method = body.method as InvitationMethod;
  if (!INVITATION_METHODS.includes(method)) {
    return NextResponse.json({ error: "招待の方式を選んでください" }, { status: 400 });
  }
  if (method === "EMAIL" && !body.recipientEmail) {
    return NextResponse.json({ error: "宛先を入力してください" }, { status: 400 });
  }

  const token = generateInvitationToken();
  const now = new Date();
  const inv: InvitationRecord = {
    id: `inv_${token.slice(0, 12)}`,
    caseId,
    createdByPartyId: partyId,
    token,
    method,
    ...(method === "EMAIL" ? { recipientEmail: body.recipientEmail } : {}),
    // ★当事者が名乗った名前。露出するかは revealSenderName で決まる
    senderName: body.senderName?.trim() || senderName,
    revealSenderName: body.revealSenderName === true,
    status: "PENDING",
    expiresAt: expiresAt(now),
    createdAt: now.toISOString(),
  };
  await saveInvitation(inv);

  const url = `${baseUrl()}/invite/${token}`;
  return NextResponse.json({
    id: inv.id,
    url,
    expiresAt: inv.expiresAt,
    // ★送る前に、相手に届く文面をそのまま返す（AC-07）
    mail:
      method === "EMAIL"
        ? buildInvitationMail({ url, senderName: inv.senderName, revealSenderName: inv.revealSenderName })
        : null,
  });
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://aida-4n47tjpp2a-an.a.run.app";
}
