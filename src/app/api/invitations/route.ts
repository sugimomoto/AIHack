import { NextResponse } from "next/server";
import { authenticate, UnauthenticatedError } from "@/lib/auth";
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
  let party;
  try {
    party = await authenticate(req);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json()) as {
    method?: string;
    recipientEmail?: string;
    revealSenderName?: boolean;
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
    caseId: party.caseId,
    createdByPartyId: party.id,
    token,
    method,
    ...(method === "EMAIL" ? { recipientEmail: body.recipientEmail } : {}),
    senderName: party.displayNameForOther,
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
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://aida.example";
}
